const express = require('express')
// const SMB2 = require('smb2')
const axios = require('axios')
var http = require('http')
var request = require('request')
const ExcelJS = require('exceljs')
const router = express.Router()
const responseTransformer = require('../../utils/response-transformer')
const Release = require('../../Models/Release')
const Project = require('../../Models/Project')
const User = require('../../Models/User')
const logger = require('../../utils/logger')
const fs = require('fs')
const fileUtils = require('../../utils/file-utils')
const imageUpload = require('express-fileupload')
const app = express()
const { Module, TestNode, TestCase } = require('../../Models/Module')
const Job = require('../../Models/Job')
const { dbResponseTransformer } = require('../../utils/response-transformer')
const { mongo, Types } = require('mongoose')
let IMAGES_ROOT_FOLDER = './public/images/'
let LOGS_ROOT_FOLDER = './public/logs/'
// const ObjectID = require('mongodb').ObjectID
const moment = require('moment')
const momentTZ = require('moment-timezone')
const AuditCreation = require('../../Models/Audits')
const Template = require('../../Models/Template')
const TempVars = require('../../Models/TempKeysStore')
const xml2js = require('xml2js')
const { create } = require('xmlbuilder2')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const path = require('path')
const sharp = require('sharp')
// const smb = require('../../utils/SmbClient')
const jobService = require('../../services/jobService')

const ADO_ENABLED = process.env.ADO_INTEGRATION_APPLICABILITY === 'true'

const {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    DeleteObjectsCommand,
    ListObjectsV2Command,
} = require('@aws-sdk/client-s3')

const {
    JobStatus,
    JobRunningStatus,
    ReleaseSchedule,
    GEN_AI_INPUT,
    ExcludeKeys,
    KEYS,
} = require('../../utils/Constants')
const common = require('../../utils/common')
const { MongoClient, ObjectId } = require('mongodb')
const TestCaseSteps = require('../../Models/TestCaseSteps')

// Release creation
router.post('/createRelease', async (req, res) => {
    try {
        // responseTransformer.releaseValidation(req.body, (err, newRelease) =>
        responseTransformer.passthroughError(
            null,
            req.body,
            'release validation',
            res,
            async (newRelease) => {
                const newModules = [...newRelease.modules]

                newModules.forEach((module, index) => {
                    if (module?.testPlaceholders) {
                        const testPlaceholders = []
                        module?.testPlaceholders.forEach((testData) => {
                            testPlaceholders.push({
                                ...testData,
                                jobId: null,
                                tpId: new ObjectId().toString(),
                                testRunProcessed: 'N',
                            })
                        })
                        newModules[index].testPlaceholders = testPlaceholders
                    }
                })

                const release = await new Release({
                    releaseName: newRelease.releaseName,
                    description: newRelease.description,
                    version: '0.1',
                    releaseVersion: newRelease.version,
                    releaseDate: newRelease.releaseDate,
                    projectID: req?.body?.projectID,
                    company: req?.body?.company?._id,
                    schedule: newRelease.schedule,
                    scheduledOn: newRelease.scheduledOn,
                    modules: newModules,
                    templateID: req?.body?.templateID,
                    createdBy: req.userId,
                    multiModuleSelection: req?.body?.multiModuleSelection,
                }).save()

                const moduleIds = newModules?.map((m) => m.moduleID)
                const modules = await Module.find({ _id: { $in: moduleIds } })

                let data = {}
                const hasAutomation = modules?.some((m) => m.automationStatus)

                if (hasAutomation) {
                    data = await createScheduleRun(
                        newRelease.schedule,
                        newRelease.scheduledOn,
                        release?._id,
                        req?.body?.templateID,
                        newRelease?.releaseName
                    )
                }

                const { errors = '', configResponse = '' } = data

                // AuditCreation.upsertAuditLog(
                //     release?.collection?.collectionName,
                //     'create',
                //     req.body?.email,
                //     req.body?.company,
                //     null,
                //     release
                // )

                responseTransformer.dbResponseTransformer(
                    null,
                    { release, info: { errors, configResponse } },
                    'create release',
                    res,
                    null
                )
            }
        )
        // )
    } catch (error) {
        logger.info(`Error while creating release ${error}`)
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

const createScheduleRun = async (
    schedule,
    scheduledOn,
    releaseId,
    templateID,
    jobName
) => {
    let configResponse = null
    let errors = []
    if (templateID) {
        const template = await Template.findById(templateID)
        if (template) {
            jenkinsConfig.parentProject = getJobName(template.name)
            jenkinsConfig.endpoint = template.endpoint
            jenkinsConfig.headers.Authorization = `Basic ${Buffer.from(
                `${template.username}:${template.password}`
            ).toString('base64')}`
            jenkinsConfig.xmlHeaders.Authorization = `Basic ${Buffer.from(
                `${template.username}:${template.password}`
            ).toString('base64')}`
        }
    }

    const crumbResponse = await axios.get(jenkinsConfig.getCrumb(), {
        headers: {
            Authorization: jenkinsConfig.headers.Authorization,
        },
    })

    jenkinsConfig.headers['Jenkins-Crumb'] = crumbResponse.data.crumb
    jenkinsConfig.xmlHeaders['Jenkins-Crumb'] = crumbResponse.data.crumb

    try {
        await axios.post(
            jenkinsConfig.deleteJob(jobName),
            {},
            { headers: jenkinsConfig.headers }
        )
        console.log('Delete Job is success')
    } catch (err) {
        logger.info(err)
    }

    if (schedule !== ReleaseSchedule.NO_REPEAT) {
        try {
            await axios.post(
                jenkinsConfig.createItem(jobName),
                {},
                { headers: jenkinsConfig.headers }
            )
        } catch (err) {
            logger.info(err)
        }

        try {
            await axios.post(
                jenkinsConfig.disableJob(jobName),
                {},
                { headers: jenkinsConfig.headers }
            )
        } catch (err) {
            logger.info(err)
        }

        try {
            await axios.post(
                jenkinsConfig.enableJob(jobName),
                {},
                { headers: jenkinsConfig.headers }
            )
        } catch (err) {
            logger.info(err)
        }

        try {
            let response = ''
            try {
                response = await axios.get(jenkinsConfig.getConfig(jobName), {
                    headers: jenkinsConfig.headers,
                })
            } catch (error) {
                console.error('Error fetching job config:', error)
                throw error
            }

            configXml = response.data?.replace("version='1.1'", "version='1.0'")
            const newConfig = getJobScheduleCron(
                scheduledOn,
                configXml,
                releaseId
            )

            const parser = new xml2js.Parser()

            parser
                .parseStringPromise(newConfig)
                .then((parsedXml) => {
                    // If parse is successful, return the original XML string
                    console.log('xml praser success')
                })
                .catch((err) => {
                    console.log('xml parsing err', err)
                })

            const builder = create(newConfig)
            modifiedXml = builder.end({ prettyPrint: true })

            try {
                const response = await axios.post(
                    jenkinsConfig.getConfig(jobName),
                    modifiedXml,
                    {
                        headers: jenkinsConfig.xmlHeaders,
                    }
                )
                configResponse = response
                console.log('Job config updated successfully:', response.status)
            } catch (error) {
                console.error('Error updating job config:', error)
                errors.push('Error updating job config:', error)
            }
        } catch (err) {
            logger.info(err)
        }
    }

    return {
        errors,
        configResponse: {
            status: configResponse?.status,
            data: configResponse?.data,
        },
    }
}

const getJobScheduleCron = (scheduledOn, data, releaseId) => {
    const startDate = scheduledOn.scheduleStart
    const endDate = scheduledOn.scheduleEnd
    const time = scheduledOn.time
    const monthDay = scheduledOn.monthDay
    const weekDay = scheduledOn.weekDay

    const serverTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const serverTime = new Date(momentTZ.tz(time, serverTimezone).format())

    const defaultCron = '<spec>H H H H H</spec>'

    let cron = serverTime.getMinutes() + ' ' + serverTime.getHours()

    if (!monthDay && !weekDay) cron = cron + ' date *'
    else if (!monthDay && weekDay) cron = cron + ' date ' + weekDay
    else if (monthDay && !weekDay) cron = cron + ' date'

    let date = null

    if (startDate.split('/')[0] === endDate.split('/')[0]) {
        if (weekDay)
            date =
                startDate.split('/')[1] +
                '-' +
                endDate.split('/')[1] +
                ' ' +
                startDate.split('/')[0]
        else if (monthDay)
            date = monthDay + ' ' + startDate.split('/')[0] + ' *'
        else
            date =
                startDate.split('/')[1] +
                '-' +
                endDate.split('/')[1] +
                ' ' +
                startDate.split('/')[0]
        cron = cron.replace('date', date)
    } else {
        let dates
        let months
        if (endDate.split('/')[0] - startDate.split('/')[0] === 1) {
            dates = [
                startDate.split('/')[1] + '-31',
                '1-' + endDate.split('/')[1],
            ]
            months = [startDate.split('/')[0], endDate.split('/')[0]]
        } else if (endDate.split('/')[0] - startDate.split('/')[0] === 2) {
            dates = [
                startDate.split('/')[1] + '-31',
                ' * ',
                '1-' + endDate.split('/')[1],
            ]
            months = [
                startDate.split('/')[0],
                parseInt(startDate.split('/')[0], 10) + 1,
                endDate.split('/')[0],
            ]
        } else {
            dates = [
                startDate.split('/')[1] + '-31',
                ' * ',
                '1-' + endDate.split('/')[1],
            ]
            months = [
                startDate.split('/')[0],
                parseInt(startDate.split('/')[0], 10) +
                    1 +
                    '-' +
                    (parseInt(endDate.split('/')[0], 10) - 1),
                endDate.split('/')[0],
            ]
        }

        const month = months[0] + '-' + months[months.length - 1]

        if (!monthDay && !weekDay) {
            for (let i = 0; i < dates.length; i++) {
                if (date)
                    date =
                        date +
                        '\n' +
                        cron.replace('date', dates[i] + ' ' + months[i])
                else date = cron.replace('date', dates[i] + ' ' + months[i])
            }
        } else if (monthDay && !weekDay) {
            if (date)
                date =
                    date +
                    '\n' +
                    cron.replace('date', monthDay + ' ' + month + ' *')
            else date = cron.replace('date', monthDay + ' ' + month + ' *')
        } else if (!monthDay && weekDay) {
            for (let i = 0; i < dates.length; i++) {
                if (date)
                    date =
                        date +
                        '\n' +
                        cron.replace('date', dates[i] + ' ' + months[i])
                else date = cron.replace('date', dates[i] + ' ' + months[i])
            }
        }
        cron = date
    }

    const releaseCron = '<spec>' + cron + '</spec>'

    newConfig = data
        .replace(defaultCron, releaseCron)
        .replace('UPDATE_RELEASE_ID', releaseId)
        .toString()
        .replace(/^\uFEFF/, '')
        .trim()

    return newConfig
}

//ALL Releases
router.get('/allReleases', async (req, res) => {
    try {
        Release.aggregate(
            [
                {
                    $sort: {
                        updatedAt: -1,
                    },
                },
            ],
            (err, releases) =>
                responseTransformer.dbResponseTransformer(
                    err,
                    releases,
                    'list all releases',
                    res
                )
        )
    } catch (error) {
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

//Release Details
router.get('/Release/:id', async (req, res) => {
    try {
        const release = await Release.findById(req.params.id)
        //, (err, release) =>
        responseTransformer.dbResponseTransformer(
            null,
            release,
            'get release',
            res
        )
        // )
    } catch (error) {
        logger.info(
            `Encountered issues while fetching release details ${error}`
        )
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

router.get('/ReleaseByPID/:projectID', async (req, res) => {
    const warnings = []
    try {
        Module.aggregate(
            [{ $match: { projectID: req.params.projectID } }],
            (err, modules) => {
                responseTransformer.passthroughError(
                    err,
                    modules,
                    'list modules',
                    res,
                    (modules) => {
                        const modulesList = modules.map((m) => m._id)
                        logger.info('Looking in modules ' + modulesList)
                        Release.find(
                            { 'modules.moduleID': { $in: modulesList } },
                            async (err, releases) => {
                                let newReleases = []
                                let responseSent = false

                                const newj = await Promise.all(
                                    releases.map(
                                        async (curRelease) => {
                                            let total = 0
                                            let untested = 0
                                            let passed = 0
                                            let failed = 0
                                            let skipped = 0
                                            let ignored = 0
                                            let warning = 0
                                            let percentage = 0
                                            let executionStart = 0
                                            let executionEnd = 0
                                            let executionDuration = 0
                                            const release =
                                                curRelease.toObject()

                                            const releaseJobsModal =
                                                await Job.find({
                                                    releaseID: release._id,
                                                })
                                            const jobModulesModal =
                                                await Job.find({
                                                    releaseID: release._id,
                                                }).sort({
                                                    updatedAt: -1,
                                                })
                                            const releaseJobs =
                                                releaseJobsModal.map((job) =>
                                                    job.toObject()
                                                )
                                            const jobModules =
                                                jobModulesModal.map((job) =>
                                                    job.toObject()
                                                )
                                            const modules = release?.modules
                                            let releaseDate = null
                                            const dates = []
                                            modules.map((module) => {
                                                if (
                                                    module?.testPlaceholders
                                                        ?.length > 0
                                                ) {
                                                    module?.testPlaceholders.map(
                                                        (tp) => {
                                                            if (
                                                                tp?.jobId?.toString()
                                                            ) {
                                                                const job =
                                                                    releaseJobs.filter(
                                                                        (job) =>
                                                                            job?._id.toString() ===
                                                                            tp?.jobId?.toString()
                                                                    )[0]

                                                                try {
                                                                    if (
                                                                        job !==
                                                                        null
                                                                    ) {
                                                                        executionStart =
                                                                            job?.executionStart
                                                                        executionEnd =
                                                                            job?.executionEnd
                                                                        executionDuration =
                                                                            job?.executionDuration

                                                                        const date =
                                                                            new Date(
                                                                                parseInt(
                                                                                    job?.executionDuration,
                                                                                    10
                                                                                )
                                                                            )

                                                                        if (
                                                                            job?.executionDuration
                                                                        ) {
                                                                            dates.push(
                                                                                job.executionDuration
                                                                            )
                                                                            if (
                                                                                releaseDate !=
                                                                                null
                                                                            ) {
                                                                                releaseDate =
                                                                                    new Date(
                                                                                        0,
                                                                                        date.getMonth() +
                                                                                            releaseDate.getMonth(),
                                                                                        date.getDay() +
                                                                                            releaseDate.getDay(),
                                                                                        date.getHours() +
                                                                                            releaseDate.getHours(),
                                                                                        date.getMinutes() +
                                                                                            releaseDate.getMinutes(),
                                                                                        date.getSeconds() +
                                                                                            releaseDate.getSeconds()
                                                                                    )
                                                                            } else {
                                                                                releaseDate =
                                                                                    date
                                                                            }
                                                                        }

                                                                        const testRun =
                                                                            job?.testRun
                                                                        const statusCounts =
                                                                            responseTransformer.getStatusCounts(
                                                                                testRun
                                                                            )
                                                                        total +=
                                                                            statusCounts?.total
                                                                        untested +=
                                                                            statusCounts?.untested
                                                                        passed +=
                                                                            statusCounts?.passed
                                                                        skipped +=
                                                                            statusCounts?.skipped
                                                                        ignored +=
                                                                            statusCounts?.ignored
                                                                        warning +=
                                                                            statusCounts?.warning
                                                                        failed +=
                                                                            statusCounts?.failed
                                                                    } else {
                                                                        total +=
                                                                            module
                                                                                ?.testNodes
                                                                                ?.length
                                                                        untested +=
                                                                            module
                                                                                ?.testNodes
                                                                                ?.length
                                                                    }
                                                                } catch (err) {
                                                                    logger.warn(
                                                                        'err',
                                                                        err
                                                                    )
                                                                }

                                                                try {
                                                                    percentage =
                                                                        parseInt(
                                                                            (passed /
                                                                                total) *
                                                                                100,
                                                                            10
                                                                        )
                                                                } catch (err) {
                                                                    warnings.push(
                                                                        err
                                                                    )
                                                                }
                                                            } else {
                                                                total +=
                                                                    module
                                                                        ?.testNodes
                                                                        ?.length
                                                                untested +=
                                                                    module
                                                                        ?.testNodes
                                                                        ?.length
                                                            }
                                                        }
                                                    )
                                                } else {
                                                    let curRun
                                                    jobModules.every((run) => {
                                                        curRun =
                                                            run?.testRun?.find(
                                                                (curModule) =>
                                                                    curModule?.moduleID ===
                                                                    module?.moduleID
                                                            )
                                                        if (curRun) {
                                                            return false
                                                        }
                                                    })

                                                    if (curRun) {
                                                        const statusCounts =
                                                            responseTransformer.getStatusCounts(
                                                                curRun
                                                            )
                                                        total =
                                                            statusCounts?.total
                                                        untested =
                                                            statusCounts?.untested
                                                        passed =
                                                            statusCounts?.passed
                                                        skipped =
                                                            statusCounts?.skipped
                                                        failed =
                                                            statusCounts?.failed
                                                        ignored =
                                                            statusCounts?.ignored
                                                        warning =
                                                            statusCounts?.warning
                                                    } else {
                                                        const testNodes =
                                                            module?.testNodes
                                                        total += parseInt(
                                                            testNodes?.length,
                                                            10
                                                        )
                                                        untested += parseInt(
                                                            testNodes?.length,
                                                            10
                                                        )
                                                    }
                                                }
                                            })

                                            let maxDate = null
                                            let maxDuration = null
                                            if (dates.length > 0) {
                                                // dates.forEach((date) => {});
                                                maxDate = new Date(
                                                    parseInt(
                                                        Math.max(...dates),
                                                        10
                                                    )
                                                )
                                                maxDuration = moment(
                                                    new Date(maxDate)
                                                ).format('m[m] s[s]')
                                            }

                                            try {
                                                percentage = parseInt(
                                                    (passed / total) * 100,
                                                    10
                                                )
                                            } catch (err) {
                                                logger.warn('err', err)
                                            }

                                            let formattedDuration = moment(
                                                new Date(
                                                    parseInt(
                                                        releaseDate
                                                            ? releaseDate.getTime()
                                                            : executionDuration,
                                                        10
                                                    )
                                                )
                                            ).format('m[m] s[s]')

                                            const newRelease = {
                                                _id: release?._id,
                                                releaseName:
                                                    release?.releaseName,
                                                description:
                                                    release?.description,
                                                version: release?.version,
                                                releaseVersion:
                                                    release?.releaseVersion,
                                                releaseDate:
                                                    release?.releaseDate,
                                                schedule: release?.schedule,
                                                modules: release?.modules,
                                                createdBy: release?.createdBy,
                                                createdAt: release?.createdAt,
                                                updatedAt: release?.updatedAt,
                                                __v: release?.__v,
                                                total,
                                                untested,
                                                passed,
                                                skipped,
                                                failed,
                                                ignored,
                                                warning,
                                                percentage,
                                                executionStart,
                                                executionEnd,
                                                executionDuration: releaseDate
                                                    ? formattedDuration
                                                    : null,
                                                maxDuration,
                                            }

                                            newReleases.push(newRelease)
                                            return newRelease
                                        }
                                        // );
                                        // }
                                    )
                                )

                                if (newReleases.length === releases.length) {
                                    releases = newReleases
                                    try {
                                        responseTransformer.dbResponseTransformer(
                                            err,
                                            newReleases,
                                            'list releases',
                                            res
                                        )
                                    } catch (e) {
                                        warnings.push(e)
                                    }
                                }
                            }
                        ).sort({ updatedAt: -1 })
                    }
                )
            }
        )
    } catch (error) {
        logger.warn(`Encountered warnings while serving request: ${warnings}`)
        res.send({ status: 400, message: 'Bad Request', data: error, warnings })
    }
})

const getReleaseExecutionDuration = async (release, version) => {
    let formattedTimeDifference = null
    try {
        const jobs = await Job.find({
            releaseID: release?._id,
            version: version,
        })
        let obj = getMultiJobsExecDuration(jobs)
        formattedTimeDifference = obj.formattedTimeDifference
    } catch (err) {
        logger.info('err in getReleaseExecutionDuration', err)
    }
    return formattedTimeDifference
}

const getReleaseModuleExecutionDuration = async (
    release,
    version,
    moduleId
) => {
    let formattedTimeDifference = null
    try {
        const jobs = await Job.find({
            releaseID: release?._id,
            version: version,
            'testRun.moduleID': moduleId?.toString(),
        })
        let obj = getMultiJobsExecDuration(jobs)
        formattedTimeDifference = obj.formattedTimeDifference
    } catch (err) {
        logger.info('err in getReleaseExecutionDuration', err)
    }
    return formattedTimeDifference
}

const getVersionExecutionDuration = async (times) => {
    let formattedDuration = ''
    try {
        const date = new Date()
        date.setMinutes(0)
        date.setSeconds(0)
        let minutes = 0
        let seconds = 0
        if (times && times?.length > 1) {
            formattedDuration = times[0]
            times?.forEach((time) => {
                if (time) {
                    const values = time.split(' ')
                    if (values.length === 2) {
                        minutes = parseInt(values[0].replace('m', ''), 10)
                        seconds = parseInt(values[1].replace('s', ''), 10)
                        date.setMinutes(date.getMinutes() + minutes)
                        date.setSeconds(date.getSeconds() + seconds)
                    } else if (values.length === 1 && time.includes('s')) {
                        seconds = parseInt(values[0].replace('s', ''), 10)
                        date.setSeconds(date.getSeconds() + seconds)
                    }
                }
            })
        } else if (times?.length === 1) {
            formattedDuration = times[0]
        }
        if (date.getMinutes() !== 0) {
            formattedDuration = `${date.getMinutes()}m ${date.getSeconds()}s`
        } else if (times?.length > 1) {
            formattedDuration = `${date.getSeconds()}s`
        }
    } catch (err) {
        logger.info('err in getVersionExecutionDuration', err)
    }
    return formattedDuration
}

router.get('/v1/ReleaseByPID/:projectID', async (req, res) => {
    const warnings = []
    try {
        const modules = await Module.aggregate([
            { $match: { projectID: req.params.projectID } },
        ])
        // (err, modules) => {
        // responseTransformer.passthroughError(
        //     null,
        //     modules,
        //     'list modules',
        //     res,
        //     (modules) => {
        if (modules.length > 0) {
            const modulesList = modules.map((m) => m._id)
            // logger.info('Looking in modules ' + modulesList)
            let releases = await Release.find({
                'modules.moduleID': { $in: modulesList },
            }).sort({ updatedAt: -1 })
            // async (err, releases) => {
            if (releases) {
                let newReleases = []
                let responseSent = false
                const releaseJobsQuery = releases?.map((release) => {
                    return {
                        releaseID: release._id,
                        version: release?.testRunVersion,
                    }
                })

                let relJobs = []

                if (releaseJobsQuery.length !== 0)
                    relJobs = await Job.find({
                        $or: releaseJobsQuery,
                    })

                const jobModulesQuery = releases?.map((release) => {
                    return {
                        releaseID: release._id,
                    }
                })

                let jobMods = []

                if (jobModulesQuery.length !== 0)
                    jobMods = await Job.find({
                        $or: jobModulesQuery,
                    })

                const newj = await Promise.all(
                    releases.map(
                        async (curRelease) => {
                            let total = 0
                            let untested = 0
                            let passed = 0
                            let failed = 0
                            let skipped = 0
                            let ignored = 0
                            let warning = 0
                            let percentage = 0
                            let executionStart = 0
                            let executionEnd = 0
                            let executionDuration = 0
                            let jobRunningStatus = ''
                            const release = curRelease.toObject()

                            // const releaseJobsModal =
                            //     await Job.find({
                            //         releaseID:
                            //             release._id,
                            //         version:
                            //             release?.testRunVersion,
                            //     })

                            const releaseJobsModal = relJobs?.filter(
                                (releaseJob) =>
                                    releaseJob.releaseID ===
                                        release._id.toString() &&
                                    releaseJob.version ===
                                        release?.testRunVersion
                            )

                            // const jobModulesModal =
                            //     await Job.find({
                            //         releaseID:
                            //             release._id,
                            //     }).sort({
                            //         updatedAt: -1,
                            //     })

                            const jobModulesModal = jobMods?.filter(
                                (releaseJob) =>
                                    releaseJob.releaseID ===
                                    release._id.toString()
                            )

                            const releaseJobs = releaseJobsModal.map((job) =>
                                job.toObject()
                            )

                            const jobModules = jobModulesModal.map((job) =>
                                job.toObject()
                            )

                            const modules = release?.modules
                            let releaseDate = null
                            const dates = []

                            modules.map((module) => {
                                if (
                                    module?.testPlaceholders?.length === 0 &&
                                    releaseJobs?.length > 0
                                ) {
                                    releaseDate = new Date(
                                        parseInt(
                                            releaseJobs[0]?.executionDuration,
                                            10
                                        )
                                    )
                                }
                                if (module?.testPlaceholders?.length > 0) {
                                    module?.testPlaceholders.map((tp) => {
                                        if (tp?.jobId?.toString()) {
                                            const job = releaseJobs.filter(
                                                (job) =>
                                                    job?._id.toString() ===
                                                    tp?.jobId?.toString()
                                            )[0]

                                            try {
                                                if (job !== null) {
                                                    executionStart =
                                                        job?.executionStart
                                                    executionEnd =
                                                        job?.executionEnd
                                                    executionDuration =
                                                        job?.executionDuration
                                                    jobRunningStatus =
                                                        job?.runningStatus
                                                    const date = new Date(
                                                        parseInt(
                                                            job?.executionDuration,
                                                            10
                                                        )
                                                    )

                                                    if (
                                                        job?.executionDuration
                                                    ) {
                                                        dates.push(
                                                            job.executionDuration
                                                        )
                                                        if (
                                                            releaseDate != null
                                                        ) {
                                                            releaseDate =
                                                                new Date(
                                                                    0,
                                                                    date.getMonth() +
                                                                        releaseDate.getMonth(),
                                                                    date.getDay() +
                                                                        releaseDate.getDay(),
                                                                    date.getHours() +
                                                                        releaseDate.getHours(),
                                                                    date.getMinutes() +
                                                                        releaseDate.getMinutes(),
                                                                    date.getSeconds() +
                                                                        releaseDate.getSeconds()
                                                                )
                                                        } else {
                                                            releaseDate = date
                                                        }
                                                    }

                                                    const testRun = job?.testRun
                                                    const statusCounts =
                                                        responseTransformer.getStatusCounts(
                                                            testRun
                                                        )
                                                    total += statusCounts?.total
                                                    untested +=
                                                        statusCounts?.untested
                                                    passed +=
                                                        statusCounts?.passed
                                                    skipped +=
                                                        statusCounts?.skipped
                                                    failed +=
                                                        statusCounts?.failed
                                                    ignored +=
                                                        statusCounts?.ignored
                                                    warning +=
                                                        statusCounts?.warning
                                                } else {
                                                    total +=
                                                        module?.testNodes
                                                            ?.length
                                                    untested +=
                                                        module?.testNodes
                                                            ?.length
                                                }
                                            } catch (err) {
                                                logger.warn('err', err)
                                            }

                                            try {
                                                percentage = parseInt(
                                                    (passed / total) * 100,
                                                    10
                                                )
                                            } catch (err) {
                                                warnings.push(err)
                                            }
                                        } else {
                                            total += module?.testNodes?.length
                                            untested +=
                                                module?.testNodes?.length
                                        }
                                    })
                                } else {
                                    let curRun
                                    jobModules.every((run) => {
                                        curRun = run?.testRun?.find(
                                            (curModule) =>
                                                curModule?.moduleID ===
                                                module?.moduleID
                                        )
                                        if (curRun) {
                                            console.log(curRun)
                                            return false
                                        }
                                    })

                                    if (curRun) {
                                        const statusCounts =
                                            responseTransformer.getStatusCounts(
                                                [curRun]
                                            )
                                        total = statusCounts?.total
                                        untested = statusCounts?.untested
                                        passed = statusCounts?.passed
                                        skipped = statusCounts?.skipped
                                        failed = statusCounts?.failed
                                        ignored = statusCounts?.ignored
                                        warning = statusCounts?.warning
                                    } else {
                                        const testNodes = module?.testNodes
                                        total += parseInt(testNodes?.length, 10)
                                        untested += parseInt(
                                            testNodes?.length,
                                            10
                                        )
                                    }
                                }
                            })

                            let maxDate = null
                            let maxDuration = null
                            if (dates.length > 0) {
                                // dates.forEach((date) => {});
                                maxDate = new Date(
                                    parseInt(Math.max(...dates), 10)
                                )
                                maxDuration = moment(new Date(maxDate)).format(
                                    'm[m] s[s]'
                                )
                            }

                            try {
                                percentage = parseInt(
                                    (passed / total) * 100,
                                    10
                                )
                            } catch (err) {
                                logger.warn('err', err)
                            }

                            let formattedDuration = moment(
                                new Date(
                                    parseInt(
                                        releaseDate
                                            ? releaseDate.getTime()
                                            : executionDuration,
                                        10
                                    )
                                )
                            ).format('m[m] s[s]')
                            if (release?.testRunVersion) {
                                formattedDuration =
                                    await getReleaseExecutionDuration(
                                        release,
                                        release?.testRunVersion
                                    )
                            }

                            const newRelease = {
                                _id: release?._id,
                                releaseName: release?.releaseName,
                                description: release?.description,
                                version: release?.version,
                                releaseDate: release?.releaseDate,
                                schedule: release?.schedule,
                                scheduledOn: release?.scheduledOn,
                                // modules:
                                //     release?.modules,
                                createdBy: release?.createdBy,
                                createdAt: release?.createdAt,
                                updatedAt: release?.updatedAt,
                                __v: release?.__v,
                                total,
                                untested,
                                passed,
                                skipped,
                                failed,
                                ignored,
                                warning,
                                percentage,
                                executionStart,
                                executionEnd,
                                executionDuration: releaseDate
                                    ? formattedDuration
                                    : null,
                                maxDuration,
                                testRunVersion: release?.testRunVersion,
                                jobRunningStatus,
                            }
                            Object.keys(newRelease).forEach((key) => {
                                if (
                                    newRelease[key] == null ||
                                    newRelease[key].toString().trim() === ''
                                ) {
                                    delete newRelease[key]
                                }
                            })
                            newReleases.push(newRelease)
                            return newRelease
                        }
                        // );
                        // }
                    )
                )
                if (newReleases.length === releases.length) {
                    releases = newReleases
                    try {
                        responseTransformer.dbResponseTransformer(
                            null,
                            newReleases,
                            'list releases',
                            res
                        )
                    } catch (e) {
                        console.log('e', e)
                        warnings.push(e)
                    }
                }
            } else {
                res.send({
                    status: 204,
                    message: 'Error at finding releases',
                    data: [],
                })
            }
            // }
            // ).sort({ updatedAt: -1 })
        } else {
            res.send({
                status: 204,
                message: 'There is no Modules',
                data: [],
            })
        }
        // }
        // )
        // }
        // )
    } catch (error) {
        console.log('error', error)
        logger.info(`Encountered error while serving request: ${error}`)
        logger.warn(`Encountered warnings while serving request: ${warnings}`)
        res.send({ status: 400, message: 'Bad Request', data: error, warnings })
    }
})

function groupBy(arr, fn) {
    return arr.reduce((acc, item) => {
        const key = fn(item)
        acc[key] = acc[key] || []
        acc[key].push(item)
        return acc
    }, {})
}
// With Pagination
// router.get(
//     '/v1/ReleaseByPID/:projectID/:SortBy/:order/:pagesize/:pageno',
//     async (req, res) => {
//         const warnings = []
//         try {
//             const { projectID, SortBy, order, pagesize, pageno } = req.params
//             const skip = parseInt(pageno) * parseInt(pagesize)
//             const limit = parseInt(pagesize)
//             const sortDir = order === 'asc' ? 1 : -1

//             // 1️⃣ Modules lookup
//             const modules = await Module.find({ projectID }, { _id: 1 }).lean()
//             const moduleIDs = modules.map((m) => m._id.toString())
//             if (moduleIDs.length === 0) {
//                 return res.json({
//                     status: 200,
//                     message: 'No modules found',
//                     data: [],
//                 })
//             }

//             // 2️⃣ Fetch Releases
//             const releases = await Release.find({
//                 'modules.moduleID': { $in: moduleIDs },
//             })
//                 .sort({ [SortBy]: sortDir })
//                 // .skip(skip)
//                 // .limit(limit)
//                 .lean()

//             const releaseIDs = releases.map((r) => r._id)

//             // 3️⃣ Fetch all Jobs once
//             const allJobs = await Job.find({
//                 releaseID: { $in: releaseIDs },
//             }).lean()

//             // Build lookup maps
//             const jobById = {}
//             const jobsByRelease = {}
//             allJobs.forEach((job) => {
//                 const jid = job._id.toString()
//                 jobById[jid] = job
//                 const rid = job.releaseID.toString()
//                 jobsByRelease[rid] = jobsByRelease[rid] || []
//                 jobsByRelease[rid].push(job)
//             })

//             // 4️⃣ Compute stats per release (batched)
//             let newReleases = await Promise.all(
//                 releases.map(async (release) => {
//                     let total = 0,
//                         passed = 0,
//                         failed = 0,
//                         skipped = 0,
//                         ignored = 0,
//                         warning = 0,
//                         untested = 0
//                     let maxDuration = 0,
//                         executionStart = null,
//                         executionEnd = null,
//                         jobRunningStatus = ''

//                     const releaseJobs =
//                         jobsByRelease[release._id.toString()] || []

//                     for (const module of release.modules || []) {
//                         if (module.testPlaceholders?.length === 0) {
//                             const job = releaseJobs?.find(
//                                 (releaseJob) =>
//                                     releaseJob?.testRun[0]?.moduleID ===
//                                     module?.moduleID?.toString()
//                             )

//                             if (!job) {
//                                 total += module?.testNodes?.length
//                                 untested += module?.testNodes?.length
//                             } else {
//                                 const stats =
//                                     responseTransformer.getStatusCounts(
//                                         job.testRun || []
//                                     )

//                                 total += stats.total || 0
//                                 passed += stats.passed || 0
//                                 failed += stats.failed || 0
//                                 skipped += stats.skipped || 0
//                                 untested += stats.untested || 0
//                                 ignored += stats.ignored || 0
//                                 warning += stats.warning || 0
//                             }
//                         }
//                         for (const tp of module.testPlaceholders || []) {
//                             const job = jobById[tp.jobId?.toString()]
//                             if (job) {
//                                 const stats =
//                                     responseTransformer.getStatusCounts(
//                                         job.testRun || []
//                                     )
//                                 total += stats.total || 0
//                                 passed += stats.passed || 0
//                                 failed += stats.failed || 0
//                                 skipped += stats.skipped || 0
//                                 untested += stats.untested || 0
//                                 ignored += stats.ignored || 0
//                                 warning += stats.warning || 0

//                                 const dur = parseInt(
//                                     job.executionDuration || 0,
//                                     10
//                                 )
//                                 if (dur > maxDuration) maxDuration = dur

//                                 if (
//                                     !executionStart ||
//                                     job.executionStart < executionStart
//                                 )
//                                     executionStart = job.executionStart
//                                 if (
//                                     !executionEnd ||
//                                     job.executionEnd > executionEnd
//                                 )
//                                     executionEnd = job.executionEnd
//                                 jobRunningStatus = job.runningStatus
//                             } else {
//                                 const fallback = module.testNodes?.length || 0
//                                 total += fallback
//                                 untested += fallback
//                             }
//                         }
//                     }

//                     const percentage = total
//                         ? parseInt((passed / total) * 100, 10)
//                         : 0
//                     const maxDurationFormatted = moment
//                         .utc(maxDuration * 1000)
//                         .format('m[m] s[s]')
//                     const executionDuration = release.testRunVersion
//                         ? await getReleaseExecutionDuration(
//                               release,
//                               release.testRunVersion
//                           )
//                         : maxDurationFormatted

//                     const obj = {
//                         _id: release._id,
//                         releaseName: release.releaseName,
//                         releaseDate: release.releaseDate,
//                         updatedAt: release.updatedAt,
//                         version: release.version,
//                         schedule: release.schedule,
//                         scheduledOn: release?.scheduledOn,
//                         total,
//                         passed,
//                         failed,
//                         skipped,
//                         ignored,
//                         warning,
//                         untested,
//                         percentage,
//                         executionStart,
//                         executionEnd,
//                         executionDuration,
//                         maxDuration: maxDurationFormatted,
//                         testRunVersion: release.testRunVersion,
//                         jobRunningStatus,
//                     }

//                     // Clean up empty/null fields
//                     Object.keys(obj).forEach((k) => {
//                         if (obj[k] == null || obj[k]?.toString().trim() === '')
//                             delete obj[k]
//                     })

//                     return obj
//                 })
//             )
//             if (SortBy === 'passRate') {
//                 if (order === 'desc')
//                     newReleases = newReleases.sort(
//                         (a, b) => b.percentage - a.percentage
//                     )
//                 else {
//                     newReleases = newReleases.sort(
//                         (a, b) => a.percentage - b.percentage
//                     )
//                 }
//             }
//             const totalCount = newReleases.length
//             const paginatedReleases = newReleases.slice(skip, skip + limit)
//             responseTransformer.dbResponseTransformer(
//                 null,
//                 paginatedReleases,
//                 'list releases',
//                 res,
//                 totalCount
//             )
//         } catch (error) {
//             logger.warn(`Encountered warnings: ${warnings}`, error)
//             res.status(500).send({
//                 status: 500,
//                 message: 'Internal Server Error',
//                 error,
//                 warnings,
//             })
//         }
//     }
// )

// Search Release with pagination
router.get(
    '/v1/ReleaseByPID/:projectID/:SortBy/:order/:pagesize/:pageno',
    async (req, res) => {
        const warnings = []
        try {
            const { projectID, SortBy, order, pagesize, pageno } = req.params
            const searchTerm = req.query?.searchTerm
            const skip = parseInt(pageno) * parseInt(pagesize)
            const limit = parseInt(pagesize)
            const sortDir = order === 'asc' ? 1 : -1

            // 1️⃣ Modules lookup
            const modules = await Module.find({ projectID }, { _id: 1 }).lean()
            const moduleIDs = modules.map((m) => m._id.toString())
            if (moduleIDs.length === 0) {
                return res.json({
                    status: 204,
                    message: 'No modules found',
                    data: [],
                })
            }

            // 2️⃣ Build search filter for Releases
            const searchFilter = {
                'modules.moduleID': { $in: moduleIDs },
            }
            if (searchTerm) {
                searchFilter.releaseName = { $regex: searchTerm, $options: 'i' } // case-insensitive search
            }

            // 3️⃣ Fetch Releases
            let releases = await Release.find(searchFilter)
                .sort({ [SortBy]: sortDir })
                .lean()

            const releaseIDs = releases.map((r) => r._id)

            // 4️⃣ Fetch all Jobs once
            const allJobs = await Job.find({
                releaseID: { $in: releaseIDs },
            }).lean()

            // Build lookup maps
            const jobById = {}
            const jobsByRelease = {}
            allJobs.forEach((job) => {
                const jid = job._id.toString()
                jobById[jid] = job
                const rid = job.releaseID.toString()
                jobsByRelease[rid] = jobsByRelease[rid] || []
                jobsByRelease[rid].push(job)
            })

            // 5️⃣ Compute stats per release (batched)
            let newReleases = await Promise.all(
                releases.map(async (release) => {
                    let total = 0,
                        passed = 0,
                        failed = 0,
                        skipped = 0,
                        ignored = 0,
                        warning = 0,
                        untested = 0
                    let maxDuration = 0,
                        executionStart = null,
                        executionEnd = null,
                        jobRunningStatus = ''

                    const releaseJobs =
                        jobsByRelease[release._id.toString()] || []

                    for (const module of release.modules || []) {
                        if (module.testPlaceholders?.length === 0) {
                            const job = releaseJobs?.find(
                                (releaseJob) =>
                                    releaseJob?.testRun[0]?.moduleID ===
                                    module?.moduleID?.toString()
                            )

                            if (!job) {
                                total += module?.testNodes?.length
                                untested += module?.testNodes?.length
                            } else {
                                const stats =
                                    responseTransformer.getStatusCounts(
                                        job.testRun || []
                                    )
                                total += stats.total || 0
                                passed += stats.passed || 0
                                failed += stats.failed || 0
                                skipped += stats.skipped || 0
                                untested += stats.untested || 0
                                ignored += stats.ignored || 0
                                warning += stats.warning || 0
                            }
                        }

                        for (const tp of module.testPlaceholders || []) {
                            const job = jobById[tp.jobId?.toString()]
                            if (job) {
                                const stats =
                                    responseTransformer.getStatusCounts(
                                        job.testRun || []
                                    )
                                total += stats.total || 0
                                passed += stats.passed || 0
                                failed += stats.failed || 0
                                skipped += stats.skipped || 0
                                untested += stats.untested || 0
                                ignored += stats.ignored || 0
                                warning += stats.warning || 0

                                const dur = parseInt(
                                    job.executionDuration || 0,
                                    10
                                )
                                if (dur > maxDuration) maxDuration = dur

                                if (
                                    !executionStart ||
                                    job.executionStart < executionStart
                                )
                                    executionStart = job.executionStart
                                if (
                                    !executionEnd ||
                                    job.executionEnd > executionEnd
                                )
                                    executionEnd = job.executionEnd
                                jobRunningStatus = job.runningStatus
                            } else {
                                const fallback = module.testNodes?.length || 0
                                total += fallback
                                untested += fallback
                            }
                        }
                    }

                    const percentage = total
                        ? parseInt((passed / total) * 100, 10)
                        : 0
                    const maxDurationFormatted = moment
                        .utc(maxDuration * 1000)
                        .format('m[m] s[s]')
                    const executionDuration = release.testRunVersion
                        ? await getReleaseExecutionDuration(
                              release,
                              release.testRunVersion
                          )
                        : maxDurationFormatted

                    const obj = {
                        _id: release._id,
                        releaseName: release.releaseName,
                        releaseDate: release.releaseDate,
                        updatedAt: release.updatedAt,
                        version: release.version,
                        schedule: release.schedule,
                        scheduledOn: release?.scheduledOn,
                        total,
                        passed,
                        failed,
                        skipped,
                        ignored,
                        warning,
                        untested,
                        percentage,
                        executionStart,
                        executionEnd,
                        executionDuration,
                        maxDuration: maxDurationFormatted,
                        testRunVersion: release.testRunVersion,
                        jobRunningStatus,
                    }

                    Object.keys(obj).forEach((k) => {
                        if (obj[k] == null || obj[k]?.toString().trim() === '')
                            delete obj[k]
                    })

                    return obj
                })
            )

            // 6️⃣ Sort by passRate if needed
            if (SortBy === 'passRate') {
                newReleases = newReleases.sort((a, b) =>
                    order === 'desc'
                        ? b.percentage - a.percentage
                        : a.percentage - b.percentage
                )
            }

            const totalCount = newReleases.length
            const paginatedReleases = newReleases.slice(skip, skip + limit)

            responseTransformer.dbResponseTransformer(
                null,
                paginatedReleases,
                'list releases',
                res,
                totalCount
            )
        } catch (error) {
            logger.warn(`Encountered warnings: ${warnings}`, error)
            res.status(500).send({
                status: 500,
                message: 'Internal Server Error',
                error,
                warnings,
            })
        }
    }
)

// router.get(
//     '/v1/ReleaseByPID/:projectID/:SortBy/:order/:pagesize/:pageno',
//     async (req, res) => {
//         const warnings = []
//         try {
//             const skipno =
//                 parseInt(req.params.pageno) * parseInt(req.params.pagesize)
//             const limitno = parseInt(req.params.pagesize)
//             Module.aggregate(
//                 [
//                     { $match: { projectID: req.params.projectID } },
//                     { $project: { _id: 1, testNodes: 1 } },
//                 ],
//                 (err, modules) => {
//                     responseTransformer.passthroughError(
//                         err,
//                         modules,
//                         'list modules',
//                         res,
//                         (modules) => {
//                             const modulesList = modules.map((m) => m._id)
//                             logger.info('Looking in modules ' + modulesList)
//                             Release.find(
//                                 { 'modules.moduleID': { $in: modulesList } },
//                                 {
//                                     _id: 1,
//                                     releaseName: 1,
//                                     description: 1,
//                                     version: 1,
//                                     releaseDate: 1,
//                                     schedule: 1,
//                                     modules: 1,
//                                     createdBy: 1,
//                                     createdAt: 1,
//                                     updatedAt: 1,
//                                     __v: 1,
//                                 },
//                                 async (err, releases) => {
//                                     let newReleases = []
//                                     let responseSent = false

//                                     const newj = await Promise.all(
//                                         releases.map(
//                                             async (curRelease) => {
//                                                 let total = 0
//                                                 let untested = 0
//                                                 let passed = 0
//                                                 let failed = 0
//                                                 let skipped = 0
//                                                 let percentage = 0
//                                                 let executionStart = 0
//                                                 let executionEnd = 0
//                                                 let executionDuration = 0
//                                                 let jobRunningStatus = ''
//                                                 const release =
//                                                     curRelease.toObject()

//                                                 const releaseJobsModal =
//                                                     await Job.find({
//                                                         releaseID: release._id,
//                                                     })
//                                                 const jobModulesModal =
//                                                     await Job.find({
//                                                         releaseID: release._id,
//                                                     }).sort({
//                                                         updatedAt: -1,
//                                                     })
//                                                 const releaseJobs =
//                                                     releaseJobsModal.map(
//                                                         (job) => job.toObject()
//                                                     )
//                                                 const jobModules =
//                                                     jobModulesModal.map((job) =>
//                                                         job.toObject()
//                                                     )
//                                                 const modules = release?.modules
//                                                 let releaseDate = null
//                                                 const dates = []
//                                                 modules.map((module) => {
//                                                     if (
//                                                         module?.testPlaceholders
//                                                             ?.length > 0
//                                                     ) {
//                                                         module?.testPlaceholders.map(
//                                                             (tp) => {
//                                                                 if (
//                                                                     tp?.jobId?.toString()
//                                                                 ) {
//                                                                     const job =
//                                                                         releaseJobs.filter(
//                                                                             (
//                                                                                 job
//                                                                             ) =>
//                                                                                 job?._id.toString() ===
//                                                                                 tp?.jobId?.toString()
//                                                                         )[0]

//                                                                     try {
//                                                                         if (
//                                                                             job !==
//                                                                             null
//                                                                         ) {
//                                                                             executionStart =
//                                                                                 job?.executionStart
//                                                                             executionEnd =
//                                                                                 job?.executionEnd
//                                                                             executionDuration =
//                                                                                 job?.executionDuration
//                                                                             jobRunningStatus =
//                                                                                 job?.runningStatus
//                                                                             const date =
//                                                                                 new Date(
//                                                                                     parseInt(
//                                                                                         job?.executionDuration,
//                                                                                         10
//                                                                                     )
//                                                                                 )

//                                                                             if (
//                                                                                 job?.executionDuration
//                                                                             ) {
//                                                                                 dates.push(
//                                                                                     job.executionDuration
//                                                                                 )
//                                                                                 if (
//                                                                                     releaseDate !=
//                                                                                     null
//                                                                                 ) {
//                                                                                     releaseDate =
//                                                                                         new Date(
//                                                                                             0,
//                                                                                             date.getMonth() +
//                                                                                                 releaseDate.getMonth(),
//                                                                                             date.getDay() +
//                                                                                                 releaseDate.getDay(),
//                                                                                             date.getHours() +
//                                                                                                 releaseDate.getHours(),
//                                                                                             date.getMinutes() +
//                                                                                                 releaseDate.getMinutes(),
//                                                                                             date.getSeconds() +
//                                                                                                 releaseDate.getSeconds()
//                                                                                         )
//                                                                                 } else {
//                                                                                     releaseDate =
//                                                                                         date
//                                                                                 }
//                                                                             }

//                                                                             const testRun =
//                                                                                 job?.testRun
//                                                                             const statusCounts =
//                                                                                 responseTransformer.getStatusCounts(
//                                                                                     testRun
//                                                                                 )
//                                                                             total +=
//                                                                                 statusCounts?.total
//                                                                             untested +=
//                                                                                 statusCounts?.untested
//                                                                             passed +=
//                                                                                 statusCounts?.passed
//                                                                             skipped +=
//                                                                                 statusCounts?.skipped
//                                                                             failed +=
//                                                                                 statusCounts?.failed
//                                                                         } else {
//                                                                             total +=
//                                                                                 module
//                                                                                     ?.testNodes
//                                                                                     ?.length
//                                                                             untested +=
//                                                                                 module
//                                                                                     ?.testNodes
//                                                                                     ?.length
//                                                                         }
//                                                                     } catch (err) {
//                                                                         logger.warn(
//                                                                             'err',
//                                                                             err
//                                                                         )
//                                                                     }

//                                                                     try {
//                                                                         percentage =
//                                                                             parseInt(
//                                                                                 (passed /
//                                                                                     total) *
//                                                                                     100,
//                                                                                 10
//                                                                             )
//                                                                     } catch (err) {
//                                                                         warnings.push(
//                                                                             err
//                                                                         )
//                                                                     }
//                                                                 } else {
//                                                                     total +=
//                                                                         module
//                                                                             ?.testNodes
//                                                                             ?.length
//                                                                     untested +=
//                                                                         module
//                                                                             ?.testNodes
//                                                                             ?.length
//                                                                 }
//                                                             }
//                                                         )
//                                                     } else {
//                                                         let curRun
//                                                         jobModules.every(
//                                                             (run) => {
//                                                                 curRun =
//                                                                     run?.testRun?.find(
//                                                                         (
//                                                                             curModule
//                                                                         ) =>
//                                                                             curModule?.moduleID ===
//                                                                             module?.moduleID
//                                                                     )
//                                                                 if (curRun) {
//                                                                     return false
//                                                                 }
//                                                             }
//                                                         )

//                                                         if (curRun) {
//                                                             const statusCounts =
//                                                                 responseTransformer.getStatusCounts(
//                                                                     curRun
//                                                                 )
//                                                             total =
//                                                                 statusCounts?.total
//                                                             untested =
//                                                                 statusCounts?.untested
//                                                             passed =
//                                                                 statusCounts?.passed
//                                                             skipped =
//                                                                 statusCounts?.skipped
//                                                             failed =
//                                                                 statusCounts?.failed
//                                                         } else {
//                                                             const testNodes =
//                                                                 module?.testNodes
//                                                             total += parseInt(
//                                                                 testNodes?.length,
//                                                                 10
//                                                             )
//                                                             untested +=
//                                                                 parseInt(
//                                                                     testNodes?.length,
//                                                                     10
//                                                                 )
//                                                         }
//                                                     }
//                                                 })

//                                                 let maxDate = null
//                                                 let maxDuration = null
//                                                 if (dates.length > 0) {
//                                                     // dates.forEach((date) => {});
//                                                     maxDate = new Date(
//                                                         parseInt(
//                                                             Math.max(...dates),
//                                                             10
//                                                         )
//                                                     )
//                                                     maxDuration = moment(
//                                                         new Date(maxDate)
//                                                     ).format('m[m] s[s]')
//                                                 }

//                                                 try {
//                                                     percentage = parseInt(
//                                                         (passed / total) * 100,
//                                                         10
//                                                     )
//                                                 } catch (err) {
//                                                     logger.warn('err', err)
//                                                 }

//                                                 let formattedDuration = moment(
//                                                     new Date(
//                                                         parseInt(
//                                                             releaseDate
//                                                                 ? releaseDate.getTime()
//                                                                 : executionDuration,
//                                                             10
//                                                         )
//                                                     )
//                                                 ).format('m[m] s[s]')
//                                                 if (release?.testRunVersion) {
//                                                     formattedDuration =
//                                                         await getReleaseExecutionDuration(
//                                                             release,
//                                                             release?.testRunVersion
//                                                         )
//                                                 }

//                                                 const newRelease = {
//                                                     _id: release?._id,
//                                                     releaseName:
//                                                         release?.releaseName,
//                                                     releaseDate:
//                                                         release?.releaseDate,
//                                                     updatedAt:
//                                                         release?.updatedAt,
//                                                     total,
//                                                     untested,
//                                                     passed,
//                                                     skipped,
//                                                     failed,
//                                                     percentage,
//                                                     executionStart,
//                                                     executionEnd,
//                                                     executionDuration:
//                                                         releaseDate
//                                                             ? formattedDuration
//                                                             : null,
//                                                     maxDuration,
//                                                     testRunVersion:
//                                                         release?.testRunVersion,
//                                                     jobRunningStatus,
//                                                 }
//                                                 Object.keys(newRelease).forEach(
//                                                     (key) => {
//                                                         if (
//                                                             newRelease[key] ==
//                                                                 null ||
//                                                             newRelease[key]
//                                                                 .toString()
//                                                                 .trim() === ''
//                                                         ) {
//                                                             delete newRelease[
//                                                                 key
//                                                             ]
//                                                         }
//                                                     }
//                                                 )
//                                                 newReleases.push(newRelease)
//                                                 return newRelease
//                                             }
//                                             // );
//                                             // }
//                                         )
//                                     )

//                                     if (
//                                         newReleases.length === releases.length
//                                     ) {
//                                         releases = newReleases
//                                         try {
//                                             responseTransformer.dbResponseTransformer(
//                                                 err,
//                                                 newReleases,
//                                                 'list releases',
//                                                 res
//                                             )
//                                         } catch (e) {
//                                             warnings.push(e)
//                                         }
//                                     }
//                                 }
//                             )
//                                 .sort({ updatedAt: -1 })
//                                 .skip(skipno)
//                                 .limit(limitno)
//                         }
//                     )
//                 }
//             )
//         } catch (error) {
//             logger.warn(`Encountered warnings while serving request: ${warnings}`)
//             res.send({
//                 status: 400,
//                 message: 'Bad Request',
//                 data: error,
//                 warnings,
//             })
//         }
//     }
// )
router.get('/v2/ReleaseByPID/:projectID', async (req, res) => {
    const warnings = []
    try {
        Module.aggregate(
            [
                { $match: { projectID: req.params.projectID } },
                { $project: { _id: 1, testNodes: 1 } },
            ],
            (err, modules) => {
                responseTransformer.passthroughError(
                    err,
                    modules,
                    'list modules',
                    res,
                    (modules) => {
                        const modulesList = modules.map((m) => m._id)
                        logger.info('Looking in modules ' + modulesList)
                        Release.find(
                            { 'modules.moduleID': { $in: modulesList } },
                            {
                                _id: 1,
                                releaseName: 1,
                                description: 1,
                                version: 1,
                                releaseDate: 1,
                                schedule: 1,
                                modules: 1,
                                createdBy: 1,
                                createdAt: 1,
                                updatedAt: 1,
                                __v: 1,
                            },
                            async (err, releases) => {
                                let newReleases = []
                                let responseSent = false

                                const newj = await Promise.all(
                                    releases.map(
                                        async (curRelease) => {
                                            let total = 0
                                            let untested = 0
                                            let passed = 0
                                            let failed = 0
                                            let skipped = 0
                                            let ignored = 0
                                            let warning = 0
                                            let percentage = 0
                                            let executionStart = 0
                                            let executionEnd = 0
                                            let executionDuration = 0
                                            let jobRunningStatus = ''
                                            const release =
                                                curRelease.toObject()

                                            const releaseJobsModal =
                                                await Job.find({
                                                    releaseID: release._id,
                                                })
                                            const jobModulesModal =
                                                await Job.find({
                                                    releaseID: release._id,
                                                }).sort({
                                                    updatedAt: -1,
                                                })
                                            const releaseJobs =
                                                releaseJobsModal.map((job) =>
                                                    job.toObject()
                                                )
                                            const jobModules =
                                                jobModulesModal.map((job) =>
                                                    job.toObject()
                                                )
                                            const modules = release?.modules
                                            let releaseDate = null
                                            const dates = []
                                            modules.map((module) => {
                                                if (
                                                    module?.testPlaceholders
                                                        ?.length > 0
                                                ) {
                                                    module?.testPlaceholders.map(
                                                        (tp) => {
                                                            if (
                                                                tp?.jobId?.toString()
                                                            ) {
                                                                const job =
                                                                    releaseJobs.filter(
                                                                        (job) =>
                                                                            job?._id.toString() ===
                                                                            tp?.jobId?.toString()
                                                                    )[0]

                                                                try {
                                                                    if (
                                                                        job !==
                                                                        null
                                                                    ) {
                                                                        executionStart =
                                                                            job?.executionStart
                                                                        executionEnd =
                                                                            job?.executionEnd
                                                                        executionDuration =
                                                                            job?.executionDuration
                                                                        jobRunningStatus =
                                                                            job?.runningStatus
                                                                        const date =
                                                                            new Date(
                                                                                parseInt(
                                                                                    job?.executionDuration,
                                                                                    10
                                                                                )
                                                                            )

                                                                        if (
                                                                            job?.executionDuration
                                                                        ) {
                                                                            dates.push(
                                                                                job.executionDuration
                                                                            )
                                                                            if (
                                                                                releaseDate !=
                                                                                null
                                                                            ) {
                                                                                releaseDate =
                                                                                    new Date(
                                                                                        0,
                                                                                        date.getMonth() +
                                                                                            releaseDate.getMonth(),
                                                                                        date.getDay() +
                                                                                            releaseDate.getDay(),
                                                                                        date.getHours() +
                                                                                            releaseDate.getHours(),
                                                                                        date.getMinutes() +
                                                                                            releaseDate.getMinutes(),
                                                                                        date.getSeconds() +
                                                                                            releaseDate.getSeconds()
                                                                                    )
                                                                            } else {
                                                                                releaseDate =
                                                                                    date
                                                                            }
                                                                        }

                                                                        const testRun =
                                                                            job?.testRun
                                                                        const statusCounts =
                                                                            responseTransformer.getStatusCounts(
                                                                                testRun
                                                                            )
                                                                        total +=
                                                                            statusCounts?.total
                                                                        untested +=
                                                                            statusCounts?.untested
                                                                        passed +=
                                                                            statusCounts?.passed
                                                                        skipped +=
                                                                            statusCounts?.skipped
                                                                        failed +=
                                                                            statusCounts?.failed
                                                                        ignored +=
                                                                            statusCounts?.ignored
                                                                        warning +=
                                                                            statusCounts?.warning
                                                                    } else {
                                                                        total +=
                                                                            module
                                                                                ?.testNodes
                                                                                ?.length
                                                                        untested +=
                                                                            module
                                                                                ?.testNodes
                                                                                ?.length
                                                                    }
                                                                } catch (err) {
                                                                    logger.warn(
                                                                        'err',
                                                                        err
                                                                    )
                                                                }

                                                                try {
                                                                    percentage =
                                                                        parseInt(
                                                                            (passed /
                                                                                total) *
                                                                                100,
                                                                            10
                                                                        )
                                                                } catch (err) {
                                                                    warnings.push(
                                                                        err
                                                                    )
                                                                }
                                                            } else {
                                                                total +=
                                                                    module
                                                                        ?.testNodes
                                                                        ?.length
                                                                untested +=
                                                                    module
                                                                        ?.testNodes
                                                                        ?.length
                                                            }
                                                        }
                                                    )
                                                } else {
                                                    let curRun
                                                    jobModules.every((run) => {
                                                        curRun =
                                                            run?.testRun?.find(
                                                                (curModule) =>
                                                                    curModule?.moduleID ===
                                                                    module?.moduleID
                                                            )
                                                        if (curRun) {
                                                            return false
                                                        }
                                                    })

                                                    if (curRun) {
                                                        const statusCounts =
                                                            responseTransformer.getStatusCounts(
                                                                curRun
                                                            )
                                                        total =
                                                            statusCounts?.total
                                                        untested =
                                                            statusCounts?.untested
                                                        passed =
                                                            statusCounts?.passed
                                                        skipped =
                                                            statusCounts?.skipped
                                                        failed =
                                                            statusCounts?.failed
                                                        ignored =
                                                            statusCounts?.ignored
                                                        warning =
                                                            statusCounts?.warning
                                                    } else {
                                                        const testNodes =
                                                            module?.testNodes
                                                        total += parseInt(
                                                            testNodes?.length,
                                                            10
                                                        )
                                                        untested += parseInt(
                                                            testNodes?.length,
                                                            10
                                                        )
                                                    }
                                                }
                                            })

                                            let maxDate = null
                                            let maxDuration = null
                                            if (dates.length > 0) {
                                                // dates.forEach((date) => {});
                                                maxDate = new Date(
                                                    parseInt(
                                                        Math.max(...dates),
                                                        10
                                                    )
                                                )
                                                maxDuration = moment(
                                                    new Date(maxDate)
                                                ).format('m[m] s[s]')
                                            }

                                            try {
                                                percentage = parseInt(
                                                    (passed / total) * 100,
                                                    10
                                                )
                                            } catch (err) {
                                                logger.warn('err', err)
                                            }

                                            let formattedDuration = moment(
                                                new Date(
                                                    parseInt(
                                                        releaseDate
                                                            ? releaseDate.getTime()
                                                            : executionDuration,
                                                        10
                                                    )
                                                )
                                            ).format('m[m] s[s]')
                                            if (release?.testRunVersion) {
                                                formattedDuration =
                                                    await getReleaseExecutionDuration(
                                                        release,
                                                        release?.testRunVersion
                                                    )
                                            }

                                            const newRelease = {
                                                _id: release?._id,
                                                releaseName:
                                                    release?.releaseName,
                                                releaseDate:
                                                    release?.releaseDate,
                                                updatedAt: release?.updatedAt,
                                                total,
                                                untested,
                                                passed,
                                                skipped,
                                                failed,
                                                ignored,
                                                warning,
                                                percentage,
                                                executionStart,
                                                executionEnd,
                                                executionDuration: releaseDate
                                                    ? formattedDuration
                                                    : null,
                                                maxDuration,
                                                testRunVersion:
                                                    release?.testRunVersion,
                                                jobRunningStatus,
                                            }
                                            Object.keys(newRelease).forEach(
                                                (key) => {
                                                    if (
                                                        newRelease[key] ==
                                                            null ||
                                                        newRelease[key]
                                                            .toString()
                                                            .trim() === ''
                                                    ) {
                                                        delete newRelease[key]
                                                    }
                                                }
                                            )
                                            newReleases.push(newRelease)
                                            return newRelease
                                        }
                                        // );
                                        // }
                                    )
                                )

                                if (newReleases.length === releases.length) {
                                    releases = newReleases
                                    try {
                                        responseTransformer.dbResponseTransformer(
                                            err,
                                            newReleases,
                                            'list releases',
                                            res
                                        )
                                    } catch (e) {
                                        warnings.push(e)
                                    }
                                }
                            }
                        ).sort({ updatedAt: -1 })
                    }
                )
            }
        )
    } catch (error) {
        logger.warn(`Encountered warnings while serving request: ${warnings}`)
        res.send({ status: 400, message: 'Bad Request', data: error, warnings })
    }
})

// Optmized version of fetching releases on the basis of Project ID

router.get('/v3/ReleaseByPID/:projectID', async (req, res) => {
    let newReleases = []
    try {
        const releases = await Release.find(
            { projectID: req.params.projectID },
            {
                _id: 1,
                releaseName: 1,
                description: 1,
                version: 1,
                releaseDate: 1,
                schedule: 1,
                modules: 1,
                createdBy: 1,
                createdAt: 1,
                updatedAt: 1,
                __v: 1,
                testRunVersion: 1,
            }
        )
        if (releases.length == 0) {
            res.send({
                status: 204,
                message: 'No releases present for this project',
                data: [],
            })
        } else {
            const jobs = await Job.find({
                projectID: req.params.projectID,
            }).sort({ updatedAt: -1 })
            await Promise.all(
                releases.map(async (release) => {
                    let percentage = 0
                    let total = 0
                    let untested = 0
                    let passed = 0
                    let failed = 0
                    let skipped = 0
                    let ignored = 0
                    let warning = 0
                    let executionStart = 0
                    let executionEnd = 0
                    let executionDuration = 0
                    let releaseDate = null
                    // let modules = []
                    const dates = []
                    let jobRunningStatus = ''
                    release?.modules.forEach((module) => {
                        const releaseJobs = jobs.filter(
                            (job) =>
                                job.releaseID.toString() ===
                                release._id.toString()
                        )
                        if (
                            module?.testPlaceholders?.length === 0 &&
                            releaseJobs?.length > 0
                        ) {
                            releaseDate = new Date(
                                parseInt(releaseJobs[0]?.executionDuration, 10)
                            )
                        }
                        if (module?.testPlaceholders?.length > 0) {
                            if (
                                module?.testPlaceholders?.[0]?.jobId?.toString()
                            ) {
                                const automatedJob = releaseJobs.find(
                                    (job) =>
                                        job._id.toString() ==
                                        module?.testPlaceholders?.[0]?.jobId?.toString()
                                )
                                // Automated Job
                                if (automatedJob !== null) {
                                    const statusCounts =
                                        responseTransformer.getStatusCounts(
                                            automatedJob.testRun
                                        )
                                    total += statusCounts?.total
                                    untested += statusCounts?.untested
                                    passed += statusCounts?.passed
                                    skipped += statusCounts?.skipped
                                    failed += statusCounts?.failed
                                    ignored += statusCounts?.ignored
                                    warning += statusCounts?.warning
                                    // percentage += statusCounts?.percentage
                                    executionStart =
                                        automatedJob?.executionStart
                                    executionEnd = automatedJob?.executionEnd
                                    executionDuration =
                                        automatedJob?.executionDuration
                                    jobRunningStatus =
                                        automatedJob?.runningStatus
                                    const date = new Date(
                                        parseInt(
                                            automatedJob?.executionDuration,
                                            10
                                        )
                                    )
                                    if (automatedJob?.executionDuration) {
                                        dates.push(
                                            automatedJob.executionDuration
                                        )
                                        if (releaseDate != null) {
                                            releaseDate = new Date(
                                                0,
                                                date.getMonth() +
                                                    releaseDate.getMonth(),
                                                date.getDay() +
                                                    releaseDate.getDay(),
                                                date.getHours() +
                                                    releaseDate.getHours(),
                                                date.getMinutes() +
                                                    releaseDate.getMinutes(),
                                                date.getSeconds() +
                                                    releaseDate.getSeconds()
                                            )
                                        } else {
                                            releaseDate = date
                                        }
                                    }
                                } else {
                                    total += parseInt(module?.testNodes?.length)
                                    untested = total
                                }
                            } else {
                                total += parseInt(module?.testNodes?.length)
                                untested = total
                            }
                        } else {
                            // Manual Job
                            const manualJob = releaseJobs.find(
                                (job) =>
                                    job?.testRun[0]?.moduleID ==
                                    module?.moduleID
                            )
                            if (manualJob) {
                                const statusCounts =
                                    responseTransformer.getStatusCounts(
                                        manualJob.testRun
                                    )
                                total = statusCounts?.total
                                untested = statusCounts?.untested
                                passed = statusCounts?.passed
                                skipped = statusCounts?.skipped
                                failed = statusCounts?.failed
                                ignored = statusCounts?.ignored
                                warning = statusCounts?.warning
                            } else {
                                total += parseInt(module?.testNodes?.length)
                                untested = total
                            }
                        }
                    })

                    let maxDate = null
                    let maxDuration = null
                    if (dates.length > 0) {
                        maxDate = new Date(parseInt(Math.max(...dates), 10))
                        maxDuration = moment(new Date(maxDate)).format(
                            'm[m] s[s]'
                        )
                    }

                    let formattedDuration = moment(
                        new Date(
                            parseInt(
                                releaseDate
                                    ? releaseDate.getTime()
                                    : executionDuration,
                                10
                            )
                        )
                    ).format('m[m] s[s]')

                    if (release?.testRunVersion) {
                        formattedDuration = await getReleaseExecutionDuration(
                            release,
                            release?.testRunVersion
                        )
                    }
                    percentage = parseInt((passed / total) * 100, 10)

                    const newRelease = {
                        _id: release?._id,
                        releaseName: release?.releaseName,
                        description: release?.description,
                        version: release?.version,
                        releaseDate: release?.releaseDate,
                        schedule: release?.schedule,
                        // scheduledOn: release?.scheduledOn,
                        // modules:
                        //     release?.modules,
                        createdBy: release?.createdBy,
                        createdAt: release?.createdAt,
                        updatedAt: release?.updatedAt,
                        __v: release?.__v,
                        total,
                        untested,
                        passed,
                        skipped,
                        failed,
                        ignored,
                        warning,
                        percentage,
                        executionStart,
                        executionEnd,
                        executionDuration: releaseDate
                            ? formattedDuration
                            : null,
                        maxDuration,
                        testRunVersion: release?.testRunVersion,
                        jobRunningStatus,
                    }
                    Object.keys(newRelease).forEach((key) => {
                        if (
                            newRelease[key] == null ||
                            newRelease[key].toString().trim() === ''
                        ) {
                            delete newRelease[key]
                        }
                    })
                    newReleases.push(newRelease)
                })
            )
            res.send(newReleases)
        }
    } catch (error) {
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

router.get('/ReleaseInfo/:releaseID', async (req, res) => {
    const warnings = []
    try {
        Release.findById(req.params.releaseID, async (err, release) => {
            let testCasesCount = 0
            let testStepsCount = 0
            let automatedTestCases = 0
            let automatedPercentage = 0
            let releaseDuration = null

            try {
                const { modules } = release

                const counts = await Promise.all(
                    modules?.map(async (module) => {
                        let curTestStepsCount = 0
                        let curAutomatedTestCases = 0
                        const moduleId = module?.moduleID
                        const moduleObj = await Module.findById(moduleId)
                        const { testNodes } = moduleObj

                        testNodes?.forEach((testNode) => {
                            if (module?.testNodes.includes(testNode?._id)) {
                                curTestStepsCount +=
                                    testNode?.testNode[0]?.testCaseSteps?.length
                            }
                        })
                        if (moduleObj?.automationStatus === true) {
                            if (module?.testPlaceholders?.length > 0) {
                                testCasesCount +=
                                    module?.testNodes?.length *
                                    module?.testPlaceholders?.length
                                testStepsCount +=
                                    curTestStepsCount *
                                    module?.testPlaceholders?.length
                                automatedTestCases +=
                                    module?.testNodes?.length *
                                    module?.testPlaceholders?.length
                            } else {
                                testCasesCount += module?.testNodes?.length
                                testStepsCount += curTestStepsCount
                                automatedTestCases += module?.testNodes?.length
                            }
                        } else {
                            testCasesCount += module?.testNodes?.length
                            testStepsCount += curTestStepsCount
                        }
                    })
                )

                automatedPercentage = parseFloat(
                    (automatedTestCases / testCasesCount) * 100
                )
                    .toFixed(2)
                    .replace('.00', '')

                const jobs = await Job.find({
                    releaseID: req.params.releaseID,
                }).sort({
                    updatedAt: -1,
                })

                const jobNames = []
                const categories = []
                const runDates = []
                const duration = []
                let untestedObj = []
                let passedObj = []
                let skippedObj = []
                let failedObj = []
                let ignoredObj = []
                let warningObj = []
                let curUntestedObj = []
                let curPassedObj = []
                let curSkippedObj = []
                let curFailedObj = []
                let curIgnoredObj = []
                let curWarningObj = []

                /** test case statuses start */

                let total = 0
                let untested = 0
                let passed = 0
                let failed = 0
                let skipped = 0
                let ignored = 0
                let warning = 0
                let percentage = 0
                const curRelease = release.toObject()

                const releaseJobsModal = await Job.find({
                    releaseID: curRelease._id,
                })
                const jobModulesModal = await Job.find({
                    releaseID: curRelease._id,
                }).sort({
                    updatedAt: -1,
                })
                const releaseJobs = releaseJobsModal.map((job) =>
                    job.toObject()
                )
                const jobModules = jobModulesModal.map((job) => job.toObject())

                jobModules?.forEach((job) => {
                    const date = new Date(parseInt(job?.executionDuration, 10))

                    if (job?.executionDuration) {
                        if (releaseDuration != null) {
                            releaseDuration = new Date(
                                0,
                                date.getMonth() + releaseDuration.getMonth(),
                                date.getDay() + releaseDuration.getDay(),
                                date.getHours() + releaseDuration.getHours(),
                                date.getMinutes() +
                                    releaseDuration.getMinutes(),
                                date.getSeconds() + releaseDuration.getSeconds()
                            )
                        } else {
                            releaseDuration = date
                        }
                    }
                })

                modules.map((module) => {
                    if (module?.testPlaceholders?.length > 0) {
                        // if (module?.testPlaceholders[0]?.jobId) {
                        module?.testPlaceholders.map((tp) => {
                            if (tp?.jobId?.toString()) {
                                const job = releaseJobs.filter(
                                    (job) =>
                                        job?._id.toString() ===
                                        tp?.jobId?.toString()
                                )[0]

                                try {
                                    if (job !== null) {
                                        const testRun = job.testRun
                                        const duration = job?.executionDuration

                                        const statusCounts =
                                            responseTransformer.getStatusCounts(
                                                testRun
                                            )
                                        total = statusCounts?.total
                                        untested = statusCounts?.untested
                                        passed = statusCounts?.passed
                                        skipped = statusCounts?.skipped
                                        failed = statusCounts?.failed
                                        ignored = statusCounts?.ignored
                                        warning = statusCounts?.warning
                                    } else {
                                        total += module?.testNodes?.length
                                        untested += module?.testNodes?.length
                                    }
                                } catch (err) {
                                    warnings.push(err)
                                }

                                try {
                                    percentage = parseInt(
                                        (passed / total) * 100,
                                        10
                                    )
                                } catch (err) {
                                    warnings.push(err)
                                }
                            } else {
                                total += module?.testNodes?.length
                                untested += module?.testNodes?.length
                            }
                        })
                    } else {
                        let curRun
                        jobModules.every((run) => {
                            curRun = run?.testRun?.find(
                                (curModule) =>
                                    curModule?.moduleID === module?.moduleID
                            )
                            if (curRun) {
                                return false
                            }
                        })

                        if (curRun) {
                            const statusCounts =
                                responseTransformer.getStatusCounts(curRun)
                            total = statusCounts?.total
                            untested = statusCounts?.untested
                            passed = statusCounts?.passed
                            skipped = statusCounts?.skipped
                            failed = statusCounts?.failed
                            ignored = statusCounts?.ignored
                            warning = statusCounts?.warning
                        } else {
                            const testNodes = module?.testNodes
                            total += parseInt(testNodes?.length, 10)
                            untested += parseInt(testNodes?.length, 10)
                        }
                    }
                })

                curUntestedObj.push(untested)
                curPassedObj.push(passed)
                curSkippedObj.push(skipped)
                curFailedObj.push(failed)
                curIgnoredObj.push(ignored)
                curWarningObj.push(warning)
                const releaseStatus = [
                    curPassedObj[0],
                    curUntestedObj[0],
                    curFailedObj[0],
                    curSkippedObj[0],
                    curIgnoredObj[0],
                    curWarningObj[0],
                ]

                /** test case statuses end */

                jobs?.map((job) => {
                    const { testRun } = job
                    let untested = 0
                    let passed = 0
                    let skipped = 0
                    let failed = 0
                    let ignored = 0
                    let warning = 0
                    const statusCounts =
                        responseTransformer.getStatusCounts(testRun)
                    total = statusCounts?.total
                    untested = statusCounts?.untested
                    passed = statusCounts?.passed
                    skipped = statusCounts?.skipped
                    failed = statusCounts?.failed
                    ignored = statusCounts?.ignored
                    warning = statusCounts?.warning

                    untestedObj.push(untested)
                    passedObj.push(passed)
                    skippedObj.push(skipped)
                    failedObj.push(failed)
                    ignoredObj.push(ignored)
                    warningObj.push(warning)

                    const dateTime = moment(
                        new Date(job.executionStart)
                    ).format("DD MMM[']YY hh:mm A")

                    if (job?.executionStart) {
                        jobNames.push(`#${job.jenkinsJobID} - ${dateTime}`)
                        categories.push(`#${job.jenkinsJobID} - ${dateTime}`)
                    } else {
                        jobNames.push(`#${job.jenkinsJobID}`)
                        categories.push(`#${job.jenkinsJobID}`)
                    }

                    runDates.push(job.updatedAt)

                    if (
                        job.executionDuration &&
                        !isNaN(job.executionDuration)
                    ) {
                        const formattedDuration = moment(
                            new Date(parseInt(job.executionDuration, 10))
                        ).format('m[m] s[s]')
                        duration.push(formattedDuration)
                    } else duration.push(0)

                    return job
                })

                let formattedDuration
                if (releaseDuration) {
                    formattedDuration = moment(
                        new Date(parseInt(releaseDuration.getTime(), 10))
                    ).format('m[m] s[s]')
                }

                const cumm_chart_data = [
                    { name: 'Untested', data: untestedObj },
                    { name: 'Passed', data: passedObj },
                    { name: 'Skipped', data: skippedObj },
                    { name: 'Failed', data: failedObj },
                    { name: 'Ignored', data: ignoredObj },
                    { name: 'Warning', data: warningObj },
                ]

                const cummulativeMetrics = { categories, cumm_chart_data }

                const releaseStatusMetrics = {
                    releaseName: curRelease.releaseName,
                    releaseStatus,
                }

                const issue_chart_data = [
                    { name: 'failed', data: failedObj },
                    { name: 'skipped', data: skippedObj },
                    { name: 'ignored', data: ignoredObj },
                    { name: 'warning', data: warningObj },
                ]

                const issuesMetrics = { categories, issue_chart_data }

                const duration_chart_data = [{ data: duration }]

                const durationMetrics = { categories, duration_chart_data }

                const newRelease = {
                    _id: release._id,
                    releaseName: release.releaseName,
                    description: release.description,
                    version: release.version,
                    releaseDate: release.releaseDate,
                    schedule: release.schedule,
                    jobNames,
                    testCasesCount,
                    testStepsCount,
                    automatedTestCases,
                    automatedPercentage,
                    testRunsCount: jobs?.length,
                    cummulativeMetrics,
                    releaseStatusMetrics,
                    issuesMetrics,
                    durationMetrics,
                    runDates,
                    createdBy: release.createdBy,
                    createdAt: release.createdAt,
                    updatedAt: release.updatedAt,
                    __v: release.__v,
                    modules: release.modules,
                    releaseDuration: formattedDuration,
                }
                responseTransformer.dbResponseTransformer(
                    err,
                    newRelease,
                    'release Info',
                    res
                )
            } catch (error) {
                warnings.push(error)
                responseTransformer.dbResponseTransformer(
                    err,
                    {},
                    'release Info',
                    res
                )
            }
        })
    } catch (error) {
        logger.warn(`Encountered warnings while serving request: ${warnings}`)
        res.send({ status: 400, message: 'Bad Request', data: error, warnings })
    }
})

router.get('/v1/ReleaseInfo/:releaseID', async (req, res) => {
    const warnings = []
    try {
        const release = await Release.findById(req.params.releaseID)
        // async (err, release) => {
        let testCasesCount = 0
        let testStepsCount = 0
        let automatedTestCases = 0
        let automatedPercentage = 0
        let releaseDuration = null

        try {
            const { modules } = release

            const counts = await Promise.all(
                modules?.map(async (module) => {
                    let curTestStepsCount = 0
                    let curAutomatedTestCases = 0
                    const moduleId = module?.moduleID
                    const moduleObj = await Module.findById(moduleId)
                    const { testNodes } = moduleObj

                    testNodes?.forEach((testNode) => {
                        if (module?.testNodes.includes(testNode?._id)) {
                            curTestStepsCount +=
                                testNode?.testNode[0]?.testCaseSteps?.length
                        }
                    })
                    if (moduleObj?.automationStatus === true) {
                        if (module?.testPlaceholders?.length > 0) {
                            testCasesCount +=
                                module?.testNodes?.length *
                                module?.testPlaceholders?.length
                            testStepsCount +=
                                curTestStepsCount *
                                module?.testPlaceholders?.length
                            automatedTestCases +=
                                module?.testNodes?.length *
                                module?.testPlaceholders?.length
                        } else {
                            testCasesCount += module?.testNodes?.length
                            testStepsCount += curTestStepsCount
                            automatedTestCases += module?.testNodes?.length
                        }
                    } else {
                        testCasesCount += module?.testNodes?.length
                        testStepsCount += curTestStepsCount
                    }
                })
            )

            automatedPercentage = parseFloat(
                (automatedTestCases / testCasesCount) * 100
            )
                .toFixed(2)
                .replace('.00', '')

            const jobs = await Job.find({
                releaseID: req.params.releaseID,
            }).sort({
                updatedAt: -1,
            })

            const jobNames = []
            const categories = []
            const runDates = []
            const duration = []
            let untestedObj = []
            let passedObj = []
            let skippedObj = []
            let failedObj = []
            let ignoredObj = []
            let warningObj = []
            let curUntestedObj = []
            let curPassedObj = []
            let curSkippedObj = []
            let curFailedObj = []
            let curIgnoredObj = []
            let curWarningObj = []

            /** test case statuses start */

            let total = 0
            let untested = 0
            let passed = 0
            let failed = 0
            let skipped = 0
            let ignored = 0
            let warning = 0
            let percentage = 0
            const curRelease = release.toObject()

            const releaseJobsModal = await Job.find({
                releaseID: curRelease._id,
            })
            const jobModulesModal = await Job.find({
                releaseID: curRelease._id,
            }).sort({
                updatedAt: -1,
            })
            const releaseJobs = releaseJobsModal.map((job) => job.toObject())
            const jobModules = jobModulesModal.map((job) => job.toObject())

            jobModules?.forEach((job) => {
                const date = new Date(parseInt(job?.executionDuration, 10))

                if (job?.executionDuration) {
                    if (releaseDuration != null) {
                        releaseDuration = new Date(
                            0,
                            date.getMonth() + releaseDuration.getMonth(),
                            date.getDay() + releaseDuration.getDay(),
                            date.getHours() + releaseDuration.getHours(),
                            date.getMinutes() + releaseDuration.getMinutes(),
                            date.getSeconds() + releaseDuration.getSeconds()
                        )
                    } else {
                        releaseDuration = date
                    }
                }
            })

            modules.map((module) => {
                if (module?.testPlaceholders?.length > 0) {
                    // if (module?.testPlaceholders[0]?.jobId) {
                    module?.testPlaceholders.map((tp) => {
                        if (tp?.jobId?.toString()) {
                            const job = releaseJobs.filter(
                                (job) =>
                                    job?._id.toString() ===
                                    tp?.jobId?.toString()
                            )[0]

                            try {
                                if (job !== null) {
                                    const testRun = job.testRun
                                    const duration = job?.executionDuration

                                    const statusCounts =
                                        responseTransformer.getStatusCounts(
                                            testRun
                                        )
                                    total = statusCounts?.total
                                    untested = statusCounts?.untested
                                    passed = statusCounts?.passed
                                    skipped = statusCounts?.skipped
                                    failed = statusCounts?.failed
                                    ignored = statusCounts?.ignored
                                    warning = statusCounts?.warning
                                } else {
                                    total += module?.testNodes?.length
                                    untested += module?.testNodes?.length
                                }
                            } catch (err) {
                                warnings.push(err)
                            }

                            try {
                                percentage = parseInt(
                                    (passed / total) * 100,
                                    10
                                )
                            } catch (err) {
                                warnings.push(err)
                            }
                        } else {
                            total += module?.testNodes?.length
                            untested += module?.testNodes?.length
                        }
                    })
                } else {
                    let curRun
                    jobModules.every((run) => {
                        curRun = run?.testRun?.find(
                            (curModule) =>
                                curModule?.moduleID === module?.moduleID
                        )
                        if (curRun) {
                            return false
                        }
                    })

                    if (curRun) {
                        const statusCounts =
                            responseTransformer.getStatusCounts([curRun])
                        total = statusCounts?.total
                        untested = statusCounts?.untested
                        passed = statusCounts?.passed
                        skipped = statusCounts?.skipped
                        failed = statusCounts?.failed
                        ignored = statusCounts?.ignored
                        warning = statusCounts?.warning
                    } else {
                        const testNodes = module?.testNodes
                        total += parseInt(testNodes?.length, 10)
                        untested += parseInt(testNodes?.length, 10)
                    }
                }
            })

            curUntestedObj.push(untested)
            curPassedObj.push(passed)
            curSkippedObj.push(skipped)
            curFailedObj.push(failed)
            curIgnoredObj.push(ignored)
            curWarningObj.push(warning)
            let releaseCounts = []
            if (release?.testRunVersion) {
                const jobs = await Job.find({
                    releaseID: release?._id,
                    version: release?.testRunVersion,
                })
                let counts = []
                jobs?.forEach((job) => {
                    const statusCounts = responseTransformer.getStatusCounts(
                        job?.testRun
                    )
                    counts.push(statusCounts)
                })
                const rCounts =
                    responseTransformer.getReleaseStatusCounts(counts)
                releaseCounts.push(rCounts.passed)
                releaseCounts.push(rCounts.untested)
                releaseCounts.push(rCounts.failed)
                releaseCounts.push(rCounts.skipped)
                releaseCounts.push(rCounts.ignored)
                releaseCounts.push(rCounts.warning)
            }
            let releaseStatus = [
                curPassedObj[0],
                curUntestedObj[0],
                curFailedObj[0],
                curSkippedObj[0],
                curIgnoredObj[0],
                curWarningObj[0],
            ]
            if (release?.testRunVersion) {
                releaseStatus = releaseCounts
            }

            /** test case statuses end */

            await Promise.all(
                jobs?.map(async (job) => {
                    const { testRun } = job
                    let untested = 0
                    let passed = 0
                    let skipped = 0
                    let failed = 0
                    let ignored = 0
                    let warning = 0
                    const statusCounts =
                        responseTransformer.getStatusCounts(testRun)
                    total = statusCounts?.total
                    untested = statusCounts?.untested
                    passed = statusCounts?.passed
                    skipped = statusCounts?.skipped
                    failed = statusCounts?.failed
                    ignored = statusCounts?.ignored
                    warning = statusCounts?.warning

                    untestedObj.push(untested)
                    passedObj.push(passed)
                    skippedObj.push(skipped)
                    failedObj.push(failed)
                    ignoredObj.push(ignored)
                    warningObj.push(warning)

                    const dateTime = moment(
                        new Date(job.executionStart)
                    ).format("DD MMM[']YY hh:mm A")

                    const moduleId = job.testRun[0].moduleID
                    const module = await Module.findById(moduleId)

                    const moduleName = module.suiteName

                    if (job?.executionStart) {
                        jobNames.push(
                            `${moduleName}_${job.jenkinsJobID} - ${dateTime}`
                        )
                        categories.push(
                            `${moduleName}_${job.jenkinsJobID} - ${dateTime}`
                        )
                    } else {
                        jobNames.push(`${moduleName}_${job.jenkinsJobID}`)
                        categories.push(`${moduleName}_${job.jenkinsJobID}`)
                    }

                    runDates.push(job.updatedAt)

                    if (
                        job.executionDuration &&
                        !isNaN(job.executionDuration)
                    ) {
                        const formattedDuration = moment(
                            new Date(parseInt(job.executionDuration, 10))
                        ).format('m[m] s[s]')
                        duration.push(formattedDuration)
                    } else duration.push(0)

                    return job
                })
            )

            let formattedDuration
            if (releaseDuration) {
                formattedDuration = moment(
                    new Date(parseInt(releaseDuration.getTime(), 10))
                ).format('m[m] s[s]')
            }

            let cumm_categories = categories

            let verUntestedObj = []
            let verPassedObj = []
            let verSkippedObj = []
            let verFailedObj = []
            let verIgnoredObj = []
            let verWarningObj = []

            let verExecutionDurations = []
            let verExecutionDuration = []

            if (release?.testRunVersion) {
                cumm_categories = []

                const jobs = await Job.find({
                    releaseID: release?._id,
                })
                const uniqueVersions = Array.from(
                    new Set(jobs.map((u) => u.version))
                )

                for (let i = 0; i < uniqueVersions?.length; i++) {
                    const jobs = await Job.find({
                        releaseID: release?._id,
                        version: uniqueVersions[i],
                    })
                    const dateTime = moment(
                        new Date(jobs[0].executionStart)
                    ).format("DD MMM[']YY hh:mm A")
                    const moduleId = modules[0].moduleID
                    const module = await Module.findById(moduleId)

                    const moduleName = module.suiteName
                    cumm_categories.push(`${release?.releaseName}_${dateTime}`)
                    verExecutionDurations.push(
                        await getReleaseExecutionDuration(
                            release,
                            uniqueVersions[i]
                        )
                    )
                    let uniqueCounts = []
                    for (let j = 0; j < jobs?.length; j++) {
                        const statusCounts =
                            responseTransformer.getStatusCounts(
                                jobs[j]?.testRun
                            )
                        uniqueCounts.push(statusCounts)
                    }
                    const rCounts =
                        responseTransformer.getReleaseStatusCounts(uniqueCounts)

                    verUntestedObj.push(rCounts?.untested)
                    verPassedObj.push(rCounts?.passed)
                    verSkippedObj.push(rCounts?.skipped)
                    verFailedObj.push(rCounts?.failed)
                    verIgnoredObj.push(rCounts?.ignored)
                    verWarningObj.push(rCounts?.warning)
                }
                verExecutionDuration = await getVersionExecutionDuration(
                    verExecutionDurations
                )
                verUntestedObj = verUntestedObj.reverse()
                verPassedObj = verPassedObj.reverse()
                verSkippedObj = verSkippedObj.reverse()
                verFailedObj = verFailedObj.reverse()
                verIgnoredObj = verIgnoredObj.reverse()
                verWarningObj = verWarningObj.reverse()
                cumm_categories = cumm_categories.reverse()
            }

            let cumm_chart_data = [
                { name: 'Untested', data: untestedObj },
                { name: 'Passed', data: passedObj },
                { name: 'Skipped', data: skippedObj },
                { name: 'Failed', data: failedObj },
                { name: 'Ignored', data: ignoredObj },
                { name: 'Warning', data: warningObj },
            ]

            let cumm_testrun_chart_data = cumm_chart_data

            if (release?.testRunVersion) {
                cumm_chart_data = [
                    { name: 'Untested', data: verUntestedObj },
                    { name: 'Passed', data: verPassedObj },
                    { name: 'Skipped', data: verSkippedObj },
                    { name: 'Failed', data: verFailedObj },
                    { name: 'Ignored', data: verIgnoredObj },
                    { name: 'Warning', data: verWarningObj },
                ]
            }

            const cummulativeMetrics = {
                categories: cumm_categories,
                cumm_chart_data,
            }

            const testRunCummulativeMetrics = {
                categories: categories,
                cumm_testrun_chart_data,
            }

            const releaseStatusMetrics = {
                releaseName: curRelease.releaseName,
                releaseStatus,
            }

            const issue_chart_data = [
                { name: 'failed', data: failedObj },
                { name: 'skipped', data: skippedObj },
                { name: 'ignored', data: ignoredObj },
                { name: 'warning', data: warningObj },
            ]

            const issuesMetrics = { categories, issue_chart_data }

            const duration_chart_data = [{ data: duration }]

            const durationMetrics = { categories, duration_chart_data }

            const newRelease = {
                _id: release._id,
                releaseName: release.releaseName,
                description: release.description,
                version: release.version,
                releaseDate: release.releaseDate,
                schedule: release.schedule,
                jobNames,
                testCasesCount,
                testStepsCount,
                automatedTestCases,
                automatedPercentage,
                testRunsCount: jobs?.length,
                cummulativeMetrics,
                releaseStatusMetrics,
                issuesMetrics,
                durationMetrics,
                runDates,
                createdBy: release.createdBy,
                createdAt: release.createdAt,
                updatedAt: release.updatedAt,
                __v: release.__v,
                modules: release.modules,
                releaseDuration:
                    verExecutionDuration?.length !== 0
                        ? verExecutionDurations[
                              verExecutionDurations.length - 1
                          ]
                        : formattedDuration,
                testRunCummulativeMetrics: release?.testRunVersion
                    ? testRunCummulativeMetrics
                    : null,
            }
            responseTransformer.dbResponseTransformer(
                null,
                newRelease,
                'release Info',
                res
            )
        } catch (error) {
            warnings.push(error)
            responseTransformer.dbResponseTransformer(
                null,
                {},
                'release Info',
                res
            )
        }
        // })
    } catch (error) {
        logger.warn(`Encountered warnings while serving request: ${warnings}`)
        res.send({ status: 400, message: 'Bad Request', data: error, warnings })
    }
})

router.get('/v1/getRelease/:releaseID', async (req, res) => {
    let warnings = []
    try {
        const release = await Release.findById(req.params.releaseID, {
            releaseName: 1,
            description: 1,
            version: 1,
            schedule: 1,
            scheduledOn: 1,
            releaseDate: 1,
            modules: 1,
            testRunVersion: 1,
            releaseVersion: 1,
            multiModuleSelection: 1,
        })
        // async (err, release) => {
        try {
            if (release) {
                let respodata = {}
                respodata.releaseName = release.releaseName
                respodata.description = release.description
                respodata.version = release.version
                respodata.schedule = release.schedule
                respodata.scheduledOn = release.scheduledOn
                respodata.releaseDate = release.releaseDate
                respodata.testRunVersion = release.testRunVersion
                respodata.releaseVersion = release.releaseVersion
                respodata.multiModuleSelection = release.multiModuleSelection
                respodata.modules = []
                respodata.moduleIDs = []
                if (release.modules.length > 0) {
                    for (let i = 0; i < release.modules.length; i++) {
                        let mddet = await Module.find(
                            { _id: release.modules[i].moduleID },
                            { suiteName: 1, testNodes: 1, outputVariables: 1 }
                        )
                        let testnodesr = release.modules[i].testNodes
                        let testCaseIDs = []
                        for (let k = 0; k < testnodesr.length; k++) {
                            for (
                                let j = 0;
                                j < mddet[0].testNodes.length;
                                j++
                            ) {
                                if (
                                    testnodesr[k] == mddet[0].testNodes[j]._id
                                ) {
                                    testCaseIDs.push(
                                        mddet[0].testNodes[j].testNode[0]
                                            .testCaseID +
                                            ' - ' +
                                            mddet[0].testNodes[j].testNode[0]
                                                .testCaseTitle
                                    )
                                }
                            }
                        }
                        respodata.modules.push({
                            moduleID: mddet[0]._id,
                            name: mddet[0].suiteName,
                            testPlaceholders:
                                release.modules[i].testPlaceholders,
                            testNodes: testnodesr,
                            testCaseIDs: testCaseIDs,
                            outputVariables: mddet[0].outputVariables,
                        })
                        respodata.moduleIDs.push(mddet[0]._id)
                    }
                    res.send({
                        status: 200,
                        Message: 'Data Avaiable',
                        data: respodata,
                    })
                } else {
                    res.status(204).send({
                        status: 204,
                        Message: 'Modules not avaiable',
                        data: [],
                    })
                }
            } else {
                res.send({
                    status: 204,
                    message: 'Release not found',
                    data: err,
                })
            }
        } catch (error) {
            warnings.push(error)
            responseTransformer.dbResponseTransformer(
                null,
                {},
                'release Info',
                res
            )
        }
        // }
        // )
    } catch (error) {
        logger.warn(`Encountered error while serving request: ${error}`)
        logger.warn(`Encountered warnings while serving request: ${warnings}`)
        res.send({ status: 400, message: 'Bad Request', data: error, warnings })
    }
})

router.post('/v1/updateRelease', async (req, res) => {
    let body = req.body
    let warnings = []
    try {
        if (!body.releaseID) {
            res.send({ status: 204, message: 'release id required', data: [] })
        } else if (!body.releaseName) {
            res.send({
                status: 204,
                message: 'release name required',
                data: [],
            })
        } else {
            const newModules = [...body.modules]

            newModules.forEach((module, index) => {
                if (module?.testPlaceholders) {
                    const testPlaceholders = []
                    module?.testPlaceholders.forEach((testData) => {
                        if (!testData.tpId) {
                            testPlaceholders.push({
                                ...testData,
                                jobId: null,
                                tpId: new mongo.ObjectId().toString(),
                                testRunProcessed: 'N',
                            })
                        } else {
                            testPlaceholders.push({
                                ...testData,
                            })
                        }
                    })
                    newModules[index].testPlaceholders = testPlaceholders
                }
            })
            const updatedRelease = await Release.findByIdAndUpdate(
                body.releaseID,
                {
                    releaseName: body.releaseName,
                    description: body.description,
                    releaseVersion: body.releaseVersion,
                    schedule: body.schedule,
                    scheduledOn: body.scheduledOn,
                    modules: newModules,
                    multiModuleSelection: body.multiModuleSelection,
                },
                { new: true } // returns the updated document
            )

            if (updatedRelease) {
                const { errors, configResponse } = await createScheduleRun(
                    body.schedule,
                    body.scheduledOn,
                    body.releaseID,
                    // release.templateID,
                    body.templateID,
                    body.releaseName
                )
                res.send({
                    status: 204,
                    message: 'Release Updated..',
                    data: [],
                    info: {
                        errors,
                        configResponse,
                    },
                })
            } else {
                res.status(204).send({
                    status: 204,
                    message: 'something went wrong',
                    data: err,
                })
            }

            // Release.findByIdAndUpdate(
            //     body.releaseID,
            //     {
            //         releaseName: body.releaseName,
            //         description: body.description,
            //         releaseVersion: body.releaseVersion,
            //         schedule: body.schedule,
            //         scheduledOn: body.scheduledOn,
            //         // releaseDate:body.releaseDate,
            //         modules: newModules,
            //     },
            //     async (err, release) => {
            //         const { errors, configResponse } = await createScheduleRun(
            //             body.schedule,
            //             body.scheduledOn,
            //             body.releaseID,
            //             release.templateID,
            //             body.releaseName
            //         )
            //         if (release) {
            //             res.send({
            //                 status: 204,
            //                 message: 'Release Updated..',
            //                 data: [],
            //                 info: {
            //                     errors,
            //                     configResponse,
            //                 },
            //             })
            //         } else {
            //             res.status(204).send({
            //                 status: 204,
            //                 message: 'something went wrong',
            //                 data: err,
            //             })
            //         }
            //     }getTestCaseSteps
            // )
        }
    } catch (error) {
        console.log('3488', error)
        logger.warn(`Encountered error while serving request: ${error}`)
        logger.warn(`Encountered warnings while serving request: ${warnings}`)
        res.send({ status: 400, message: 'Bad Request', data: error, warnings })
    }
})

//update Release
router.patch('/Release/update/:id', async (req, res) => {
    try {
        responseTransformer.releaseValidation(req.body, (err, newRelease) =>
            responseTransformer.passthroughError(
                err,
                newRelease,
                'release validation',
                res,
                (newRelease) => {
                    Release.findById(req.params.id, (err, dbRelease) =>
                        responseTransformer.passthroughError(
                            err,
                            dbRelease,
                            'get release',
                            res,
                            (dbRelease) => {
                                Release.findByIdAndUpdate(
                                    req.params.id,
                                    {
                                        releaseName: newRelease.releaseName,
                                        testPlaceholders:
                                            newRelease.testPlaceholders,
                                        createdBy: dbRelease.userId,
                                        updatedBy: req.userId,
                                    },
                                    (err, release) =>
                                        responseTransformer.dbResponseTransformer(
                                            err,
                                            release,
                                            'update release',
                                            res
                                        )
                                )
                            }
                        )
                    )
                }
            )
        )
    } catch (error) {
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

//Delete Release
router.delete('/Release/delete/:id', async (req, res) => {
    try {
        const deletedRelease = await Release.findById(req.params.id)
        // , async (err, deletedRelease) => {
        if (deletedRelease) {
            let releasename = deletedRelease?.releaseName
            // try {
            //     axios.post(
            //         jenkinsConfig.deleteJob(releasename),
            //         {},
            //         { headers: jenkinsConfig.headers }
            //     )
            // } catch (err) {
            //     // logger.info(err)
            // }
            logger.info('Deleted release jenkins job')
            // for (let i = 0; i < deletedRelease.modules.length; i++) {
            //     let moduleid = deletedRelease.modules[i].moduleID
            //     let testplaceholders =
            //         deletedRelease.modules[i].testPlaceholders
            //     // Module.findById(
            //     //     moduleid,
            //     //     { suiteName: 1 },
            //     //     (err, suitnames) => {
            //     //         for (let k = 0; k < testplaceholders.length; k++) {
            //     //             const jobName = `${deletedRelease.releaseName}_${suitnames?.suiteName}_${k + 1}`
            //     //             // try {
            //     //             //     axios.post(
            //     //             //         jenkinsConfig.deleteJob(jobName),
            //     //             //         {},
            //     //             //         { headers: jenkinsConfig.headers }
            //     //             //     )
            //     //             // } catch (err) {
            //     //             //     // logger.info(err)
            //     //             // }
            //     //         }
            //     //     }
            //     // )
            // }
            const release = await Release.findById(req.params.id)
            await release.deleteOne()
            const jobs = await Job.deleteMany({ releaseID: req.params.id })
            // Release.remove({ _id: req.params.id }, async (err, release) => {
            //     await Job.deleteMany({ releaseID: req.params.id })
            //     // AuditCreation.upsertAuditLog(
            //     //     deletedRelease.collection.collectionName,
            //     //     'delete',
            //     //     req.body?.email,
            //     //     req.body?.company,
            //     //     deletedRelease
            //     // )
            //     responseTransformer.dbResponseTransformer(
            //         err,
            //         release,
            //         'deleting release',
            //         res
            //     )
            // })
            res.send({
                status: 200,
                message: 'Release and jobs deleted !!',
                data: [],
            })
        } else {
            res.send({
                status: 400,
                message: 'Release not found',
                data: [],
            })
        }
        // })
    } catch (error) {
        logger.info(`Encountered issue while deleting the release ${error}`)
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

let endpoint = process.env.JENKINS_HOST
let auth = process.env.JENKINS_AUTH

const getJobName = (releaseName) => {
    return releaseName.replace(/[^a-zA-Z0-9]/g, '_')
}

let jenkinsConfig = {
    endpoint,
    parentProject: process.env.JENKINS_PARENT_PROJECT || 'TestEnsure',
    createItem: (releaseName) =>
        `${jenkinsConfig.endpoint}/createItem?name=${getJobName(
            releaseName
        )}&mode=copy&from=${jenkinsConfig.parentProject}`,
    getAllJobs: () => `${jenkinsConfig.endpoint}/api/json`,
    disableJob: (releaseName) =>
        `${jenkinsConfig.endpoint}/job/${getJobName(releaseName)}/disable`,
    enableJob: (releaseName) =>
        `${jenkinsConfig.endpoint}/job/${getJobName(releaseName)}/enable`,
    deleteJob: (releaseName) =>
        `${jenkinsConfig.endpoint}/job/${getJobName(releaseName)}/doDelete`,
    runJob: (releaseName, jobID) =>
        `${jenkinsConfig.endpoint}/job/${getJobName(releaseName)}/buildWithParameters?JOB_ID=${jobID}`,
    stopJobWithBuildId: (jenkinsBuildId) =>
        `${jenkinsConfig.endpoint}/queue/cancelItem?id=${jenkinsBuildId}`,
    stopJobWithBuildNumber: (releaseName, jenkinsBuildNumber) =>
        `${jenkinsConfig.endpoint}/job/${getJobName(releaseName)}/${jenkinsBuildNumber}/stop`,
    streamUrl: (releaseName, jobId, streamPath) =>
        `${jenkinsConfig.endpoint}/job/${getJobName(releaseName)}/ws/${jobId}/stream/${streamPath}`,
    getConfig: (releaseName) =>
        `${jenkinsConfig.endpoint}/job/${getJobName(releaseName)}/config.xml`,
    getCrumb: () => `${jenkinsConfig.endpoint}/crumbIssuer/api/json`,
    headers: {
        Authorization: `Basic ${Buffer.from(auth).toString('base64')}`,
        // Authorization: `Basic ${Buffer.from("admin:118126dfb0e9379362cd12829d6afe5eed").toString('base64')}`,
        'Jenkins-Crumb': '',
    },
    xmlHeaders: {
        Authorization: `Basic ${Buffer.from(auth).toString('base64')}`,
        'Content-Type': 'application/xml',
        // Authorization: `Basic ${Buffer.from("admin:118126dfb0e9379362cd12829d6afe5eed").toString('base64')}`,
        'Jenkins-Crumb': '',
        // 'Transfer-Encoding': 'chunked',
    },
}

const removeCircular = (data) =>
    JSON.parse(JSON.stringify(data, responseTransformer.getCircularReplacer()))

// TestResult creation
router.post('/createJob/:releaseID', async (req, res) => {
    const warnings = []
    try {
        const version = req.body.version
        Release.findById(req.params.releaseID, (err, release) => {
            responseTransformer.passthroughError(
                err,
                release,
                'finding release',
                res,
                async (release) => {
                    const releaseName = release.releaseName
                    const releaseData = release.toObject()
                    const releaseModules = release.toObject()?.modules
                    const moduleModal = await Module.find({})
                    const automationJobs = []
                    const updatedAutomationJobs = {}
                    const moduleData = moduleModal.map((module) => {
                        const tempModule = module.toObject()
                        return {
                            ...tempModule,
                            _id: tempModule?._id.toString(),
                        }
                    })
                    const templateID = release?.templateID
                    logger.info('Getting crumb data')
                    if (templateID) {
                        const template = await Template.findById(templateID)
                        if (template) {
                            jenkinsConfig.parentProject = getJobName(
                                template.name
                            )
                            jenkinsConfig.endpoint = template.endpoint
                            jenkinsConfig.headers.Authorization = `Basic ${Buffer.from(
                                `${template.username}:${template.password}`
                            ).toString('base64')}`
                        }
                    }
                    axios
                        .get(jenkinsConfig.getCrumb(), {
                            headers: {
                                Authorization:
                                    jenkinsConfig.headers.Authorization,
                            },
                        })
                        .then((data) => {
                            jenkinsConfig.headers['Jenkins-Crumb'] =
                                data.data.crumb
                            if (releaseModules?.length > 0) {
                                releaseModules.forEach(
                                    async (releaseModule, index) => {
                                        const releaseModuleIndex = index
                                        const isAutomated = moduleData.filter(
                                            (module) =>
                                                module?._id ===
                                                releaseModule?.moduleID
                                        )[0]?.automationStatus
                                        if (isAutomated) {
                                            /** automation case **/
                                            try {
                                                releaseModule?.testPlaceholders.forEach(
                                                    async (testData, index) => {
                                                        try {
                                                            const testDataIndex =
                                                                index
                                                            const tpId =
                                                                testData?.tpId
                                                            const relModule =
                                                                await Module.findById(
                                                                    releaseModule?.moduleID,
                                                                    (
                                                                        err,
                                                                        module
                                                                    ) => {
                                                                        warnings.push(
                                                                            err
                                                                        )
                                                                    }
                                                                )

                                                            const jobName = `${releaseName}_${
                                                                relModule?.suiteName
                                                            }_${index + 1}`

                                                            new Job({
                                                                jenkinsJobID:
                                                                    'TODO',
                                                                jenkinsPath:
                                                                    'TODO',
                                                                tpId: 'TODO',
                                                                releaseID:
                                                                    req.params
                                                                        .releaseID,
                                                                createdBy:
                                                                    req.userId,
                                                            }).save(
                                                                async (
                                                                    err,
                                                                    job
                                                                ) => {
                                                                    logger.info(
                                                                        'Trying to run the job'
                                                                    )
                                                                    /** updating jobId in release test Data Ends **/
                                                                    responseTransformer.passthroughError(
                                                                        err,
                                                                        job,
                                                                        'creating job',
                                                                        res,
                                                                        (
                                                                            job
                                                                        ) => {
                                                                            logger.info(
                                                                                'Trying to create a job'
                                                                            )
                                                                            axios
                                                                                .post(
                                                                                    jenkinsConfig.createItem(
                                                                                        jobName
                                                                                    ),
                                                                                    {},
                                                                                    {
                                                                                        headers:
                                                                                            jenkinsConfig.headers,
                                                                                    }
                                                                                )
                                                                                .catch(
                                                                                    (
                                                                                        cjerr
                                                                                    ) =>
                                                                                        logger.error(
                                                                                            'Issue while posting to jenkins',
                                                                                            {
                                                                                                stack: cjerr.stack,
                                                                                            }
                                                                                        )
                                                                                )
                                                                                .finally(
                                                                                    () => {
                                                                                        logger.info(
                                                                                            'Trying to disable the job'
                                                                                        )
                                                                                        axios
                                                                                            .post(
                                                                                                jenkinsConfig.disableJob(
                                                                                                    jobName
                                                                                                ),
                                                                                                {},
                                                                                                {
                                                                                                    headers:
                                                                                                        jenkinsConfig.headers,
                                                                                                }
                                                                                            )
                                                                                            .catch(
                                                                                                (
                                                                                                    djerr
                                                                                                ) =>
                                                                                                    logger.error(
                                                                                                        'Issue while disabling the job',
                                                                                                        {
                                                                                                            stack: djerr.stack,
                                                                                                        }
                                                                                                    )
                                                                                            )
                                                                                            .finally(
                                                                                                () => {
                                                                                                    logger.info(
                                                                                                        'Trying to enable the job'
                                                                                                    )
                                                                                                    axios
                                                                                                        .post(
                                                                                                            jenkinsConfig.enableJob(
                                                                                                                jobName
                                                                                                            ),
                                                                                                            {},
                                                                                                            {
                                                                                                                headers:
                                                                                                                    jenkinsConfig.headers,
                                                                                                            }
                                                                                                        )
                                                                                                        .catch(
                                                                                                            (
                                                                                                                ejerr
                                                                                                            ) =>
                                                                                                                logger.error(
                                                                                                                    'Issue while enabling the job',
                                                                                                                    {
                                                                                                                        stack: ejerr.stack,
                                                                                                                    }
                                                                                                                )
                                                                                                        )
                                                                                                        .finally(
                                                                                                            () => {
                                                                                                                axios
                                                                                                                    .post(
                                                                                                                        jenkinsConfig.runJob(
                                                                                                                            jobName,
                                                                                                                            job._id
                                                                                                                        ),
                                                                                                                        {},
                                                                                                                        {
                                                                                                                            headers:
                                                                                                                                jenkinsConfig.headers,
                                                                                                                        }
                                                                                                                    )
                                                                                                                    .then(
                                                                                                                        async (
                                                                                                                            rjdata
                                                                                                                        ) => {
                                                                                                                            logger.info(
                                                                                                                                `Run job success, ${JSON.stringify(
                                                                                                                                    rjdata,
                                                                                                                                    responseTransformer.getCircularReplacer()
                                                                                                                                )}`
                                                                                                                            )
                                                                                                                            const locationItemRegex =
                                                                                                                                /.*?\/queue\/item\/(\d+)\//g
                                                                                                                            const itemID =
                                                                                                                                locationItemRegex.exec(
                                                                                                                                    rjdata
                                                                                                                                        .headers
                                                                                                                                        .location
                                                                                                                                )[1]
                                                                                                                            Release.findById(
                                                                                                                                req
                                                                                                                                    .params
                                                                                                                                    .releaseID,
                                                                                                                                (
                                                                                                                                    err,
                                                                                                                                    release
                                                                                                                                ) => {
                                                                                                                                    responseTransformer.passthroughError(
                                                                                                                                        err,
                                                                                                                                        release,
                                                                                                                                        'find release',
                                                                                                                                        res,
                                                                                                                                        async (
                                                                                                                                            release
                                                                                                                                        ) => {
                                                                                                                                            const mods =
                                                                                                                                                await Promise.all(
                                                                                                                                                    removeCircular(
                                                                                                                                                        release.modules
                                                                                                                                                    ).map(
                                                                                                                                                        async (
                                                                                                                                                            m
                                                                                                                                                        ) => {
                                                                                                                                                            const dbModule =
                                                                                                                                                                moduleData.filter(
                                                                                                                                                                    (
                                                                                                                                                                        module
                                                                                                                                                                    ) =>
                                                                                                                                                                        module?._id ===
                                                                                                                                                                        m.moduleID
                                                                                                                                                                )[0]
                                                                                                                                                            return {
                                                                                                                                                                moduleID:
                                                                                                                                                                    m.moduleID,
                                                                                                                                                                status: JobStatus.UNTESTED,
                                                                                                                                                                testNodes:
                                                                                                                                                                    m.testNodes.map(
                                                                                                                                                                        (
                                                                                                                                                                            tn
                                                                                                                                                                        ) => {
                                                                                                                                                                            const dbTestNode =
                                                                                                                                                                                dbModule.testNodes
                                                                                                                                                                                    .filter(
                                                                                                                                                                                        (
                                                                                                                                                                                            _tn
                                                                                                                                                                                        ) =>
                                                                                                                                                                                            _tn._id.toString() ===
                                                                                                                                                                                            tn
                                                                                                                                                                                    )
                                                                                                                                                                                    .find(
                                                                                                                                                                                        (
                                                                                                                                                                                            _
                                                                                                                                                                                        ) =>
                                                                                                                                                                                            true
                                                                                                                                                                                    )
                                                                                                                                                                                    .testNode.find(
                                                                                                                                                                                        (
                                                                                                                                                                                            _
                                                                                                                                                                                        ) =>
                                                                                                                                                                                            true
                                                                                                                                                                                    )
                                                                                                                                                                            return {
                                                                                                                                                                                testNodeID:
                                                                                                                                                                                    tn,
                                                                                                                                                                                status: JobStatus.UNTESTED,
                                                                                                                                                                                testCaseSteps:
                                                                                                                                                                                    dbTestNode.testCaseSteps.map(
                                                                                                                                                                                        (
                                                                                                                                                                                            tcs
                                                                                                                                                                                        ) => {
                                                                                                                                                                                            return {
                                                                                                                                                                                                _id: tcs._id,
                                                                                                                                                                                                status: JobStatus.UNTESTED,
                                                                                                                                                                                            }
                                                                                                                                                                                        }
                                                                                                                                                                                    ),
                                                                                                                                                                            }
                                                                                                                                                                        }
                                                                                                                                                                    ),
                                                                                                                                                            }
                                                                                                                                                        }
                                                                                                                                                    )
                                                                                                                                                )
                                                                                                                                            const currentJobModule =
                                                                                                                                                mods.filter(
                                                                                                                                                    (
                                                                                                                                                        module
                                                                                                                                                    ) =>
                                                                                                                                                        module.moduleID ===
                                                                                                                                                        releaseModules[
                                                                                                                                                            releaseModuleIndex
                                                                                                                                                        ]
                                                                                                                                                            ?.moduleID
                                                                                                                                                )

                                                                                                                                            await Job.findByIdAndUpdate(
                                                                                                                                                job._id,
                                                                                                                                                {
                                                                                                                                                    jenkinsJobID:
                                                                                                                                                        itemID,
                                                                                                                                                    jenkinsPath:
                                                                                                                                                        rjdata
                                                                                                                                                            .headers
                                                                                                                                                            .location,
                                                                                                                                                    releaseID:
                                                                                                                                                        req
                                                                                                                                                            .params
                                                                                                                                                            .releaseID,
                                                                                                                                                    testRun:
                                                                                                                                                        currentJobModule,
                                                                                                                                                    tpId: testData?.tpId,
                                                                                                                                                    createdBy:
                                                                                                                                                        req.userId,
                                                                                                                                                    version,
                                                                                                                                                    runningStatus:
                                                                                                                                                        'In Queue',
                                                                                                                                                },
                                                                                                                                                async (
                                                                                                                                                    err,
                                                                                                                                                    job
                                                                                                                                                ) => {
                                                                                                                                                    const trigeredJob =
                                                                                                                                                        {
                                                                                                                                                            _id: job._id,
                                                                                                                                                            jenkinsJobID:
                                                                                                                                                                itemID,
                                                                                                                                                            jenkinsPath:
                                                                                                                                                                rjdata
                                                                                                                                                                    .headers
                                                                                                                                                                    .location,
                                                                                                                                                            tpId: job.tpId,
                                                                                                                                                            releaseID:
                                                                                                                                                                job.releaseID,
                                                                                                                                                            createdBy:
                                                                                                                                                                job.createdBy,
                                                                                                                                                            createdAt:
                                                                                                                                                                job.createdAt,
                                                                                                                                                            updatedAt:
                                                                                                                                                                job.updatedAt,
                                                                                                                                                            __v: job.__v,
                                                                                                                                                            name: `${release.releaseName}_${itemID}`,
                                                                                                                                                        }
                                                                                                                                                    updatedAutomationJobs[
                                                                                                                                                        tpId
                                                                                                                                                    ] =
                                                                                                                                                        job._id
                                                                                                                                                    // return job;
                                                                                                                                                }
                                                                                                                                            ).then(
                                                                                                                                                (
                                                                                                                                                    jobs,
                                                                                                                                                    error
                                                                                                                                                ) => {
                                                                                                                                                    const updatedModules =
                                                                                                                                                        [
                                                                                                                                                            ...releaseModules,
                                                                                                                                                        ]
                                                                                                                                                    updatedModules[
                                                                                                                                                        releaseModuleIndex
                                                                                                                                                    ].testPlaceholders[
                                                                                                                                                        testDataIndex
                                                                                                                                                    ] =
                                                                                                                                                        {
                                                                                                                                                            ...updatedModules[
                                                                                                                                                                releaseModuleIndex
                                                                                                                                                            ]
                                                                                                                                                                .testPlaceholders[
                                                                                                                                                                testDataIndex
                                                                                                                                                            ],
                                                                                                                                                            jobId: job._id,
                                                                                                                                                            jenkinsJobID:
                                                                                                                                                                itemID,
                                                                                                                                                        }
                                                                                                                                                    Release.findByIdAndUpdate(
                                                                                                                                                        req
                                                                                                                                                            .params
                                                                                                                                                            .releaseID,
                                                                                                                                                        {
                                                                                                                                                            modules:
                                                                                                                                                                updatedModules,
                                                                                                                                                        },
                                                                                                                                                        function (
                                                                                                                                                            err,
                                                                                                                                                            result
                                                                                                                                                        ) {
                                                                                                                                                            if (
                                                                                                                                                                err
                                                                                                                                                            ) {
                                                                                                                                                                warnings.push(
                                                                                                                                                                    `error while updating relese test data = 
                                                                      ${err}`
                                                                                                                                                                )
                                                                                                                                                            } else {
                                                                                                                                                                warnings.push(
                                                                                                                                                                    `test data updates successfully result = 
                                                                      ${result}`
                                                                                                                                                                )
                                                                                                                                                            }
                                                                                                                                                        }
                                                                                                                                                    )
                                                                                                                                                }
                                                                                                                                            )
                                                                                                                                        }
                                                                                                                                    )
                                                                                                                                }
                                                                                                                            )
                                                                                                                        }
                                                                                                                    )
                                                                                                                    .catch(
                                                                                                                        (
                                                                                                                            rjerr
                                                                                                                        ) => {
                                                                                                                            logger.error(
                                                                                                                                'Run job error',
                                                                                                                                {
                                                                                                                                    stack: rjerr.stack,
                                                                                                                                }
                                                                                                                            )
                                                                                                                            res.status(
                                                                                                                                400
                                                                                                                            ).json(
                                                                                                                                rjerr.data
                                                                                                                            )
                                                                                                                        }
                                                                                                                    )
                                                                                                            }
                                                                                                        )
                                                                                                }
                                                                                            )
                                                                                    }
                                                                                )
                                                                        }
                                                                    )
                                                                }
                                                            )
                                                        } catch (error) {
                                                            res.status(
                                                                400
                                                            ).json(
                                                                `error inside create job for automation case ${error}`
                                                            )
                                                        }
                                                    }
                                                )
                                                //testPlaceholders for loop
                                                const releaseId =
                                                    releaseData?._id
                                                warnings.push(
                                                    `finally updated automation josbs = 
                        ${automationJobs}`
                                                )
                                                /**update tps with job Ids starts*/
                                                const updatedModules = [
                                                    ...releaseModules,
                                                ]
                                            } catch (error) {
                                                warnings.puhs(
                                                    `error occurred in createjob ${error}`
                                                )
                                            }
                                            /**update tps with job Ids ends*/
                                        } else {
                                            //manual case
                                            try {
                                                new Job({
                                                    jenkinsJobID: Math.floor(
                                                        Math.random() * 100 +
                                                            100
                                                    ),
                                                    jenkinsPath: 'TODO',
                                                    releaseID:
                                                        req.params.releaseID,
                                                    createdBy: req.userId,
                                                }).save((err, job) => {
                                                    logger.info(
                                                        'Trying to run the job'
                                                    )
                                                    responseTransformer.passthroughError(
                                                        err,
                                                        job,
                                                        'creating job',
                                                        res,
                                                        (job) => {
                                                            Release.findById(
                                                                req.params
                                                                    .releaseID,
                                                                (
                                                                    err,
                                                                    release
                                                                ) => {
                                                                    responseTransformer.passthroughError(
                                                                        err,
                                                                        release,
                                                                        'find release',
                                                                        res,
                                                                        async (
                                                                            release
                                                                        ) => {
                                                                            const mods =
                                                                                await Promise.all(
                                                                                    removeCircular(
                                                                                        release.modules
                                                                                    ).map(
                                                                                        async (
                                                                                            m
                                                                                        ) => {
                                                                                            const dbModule =
                                                                                                moduleData.filter(
                                                                                                    (
                                                                                                        module
                                                                                                    ) =>
                                                                                                        module?._id ===
                                                                                                        m.moduleID
                                                                                                )[0]
                                                                                            return {
                                                                                                moduleID:
                                                                                                    m.moduleID,
                                                                                                status: JobStatus.UNTESTED,
                                                                                                testNodes:
                                                                                                    m.testNodes.map(
                                                                                                        (
                                                                                                            tn
                                                                                                        ) => {
                                                                                                            const dbTestNode =
                                                                                                                dbModule.testNodes
                                                                                                                    .filter(
                                                                                                                        (
                                                                                                                            _tn
                                                                                                                        ) =>
                                                                                                                            _tn._id.toString() ===
                                                                                                                            tn
                                                                                                                    )
                                                                                                                    .find(
                                                                                                                        (
                                                                                                                            _
                                                                                                                        ) =>
                                                                                                                            true
                                                                                                                    )
                                                                                                                    .testNode.find(
                                                                                                                        (
                                                                                                                            _
                                                                                                                        ) =>
                                                                                                                            true
                                                                                                                    )
                                                                                                            return {
                                                                                                                testNodeID:
                                                                                                                    tn,
                                                                                                                status: JobStatus.UNTESTED,
                                                                                                                testCaseSteps:
                                                                                                                    dbTestNode.testCaseSteps.map(
                                                                                                                        (
                                                                                                                            tcs
                                                                                                                        ) => {
                                                                                                                            return {
                                                                                                                                _id: tcs._id,
                                                                                                                                status: JobStatus.UNTESTED,
                                                                                                                            }
                                                                                                                        }
                                                                                                                    ),
                                                                                                            }
                                                                                                        }
                                                                                                    ),
                                                                                            }
                                                                                        }
                                                                                    )
                                                                                )
                                                                            const currentJobModule =
                                                                                mods.filter(
                                                                                    (
                                                                                        module
                                                                                    ) =>
                                                                                        module.moduleID ===
                                                                                        releaseModules[
                                                                                            releaseModuleIndex
                                                                                        ]
                                                                                            ?.moduleID
                                                                                )
                                                                            Job.findByIdAndUpdate(
                                                                                job._id,
                                                                                {
                                                                                    releaseID:
                                                                                        req
                                                                                            .params
                                                                                            .releaseID,
                                                                                    testRun:
                                                                                        currentJobModule,
                                                                                    createdBy:
                                                                                        req.userId,
                                                                                },
                                                                                (
                                                                                    err,
                                                                                    job
                                                                                ) => {
                                                                                    const job1 =
                                                                                        job.toObject()
                                                                                }
                                                                            )
                                                                        }
                                                                    )
                                                                }
                                                            )
                                                        }
                                                    )
                                                })
                                            } catch (error) {
                                                res.status(400).json(
                                                    `error in create job for manual case${error}`
                                                )
                                            }
                                        } //manual case-end
                                    }
                                ) //releaseModules for loop
                            } // if releaseModules.length>0
                        })
                }
            )
        })
    } catch (error) {
        logger.warn(`Encountered warnings while serving request: ${warnings}`)
        res.send({ status: 400, message: 'Bad Request', data: error, warnings })
    }
})

const createJenkinsJob = async (
    release,
    newTestRuns,
    userId,
    status,
    video
) => {
    logger.info('Getting crumb data')
    try {
        release = await Release.findById(release._id)
        newTestRuns?.forEach(async (newTestRun, index) => {
            let job = null
            const module = await Module.findById(newTestRun.moduleID)
            const relModule = release?.modules?.find(
                (module) =>
                    module.moduleID.toString() ===
                    newTestRun.moduleID.toString(0)
            )

            if (relModule) {
                const { testPlaceholders } = relModule

                if (
                    !module?.automationStatus &&
                    testPlaceholders.length === 0
                ) {
                    const createdJob = await new Job({
                        jenkinsJobID: JobRunningStatus.MANUAL,
                        jenkinsPath: JobRunningStatus.MANUAL,
                        releaseID: release._id,
                        createdBy: userId,
                        dependsOn: null,
                        runningStatus: JobRunningStatus.MANUAL,
                        version: release?.testRunVersion,
                        jenkinsJobName: '',
                        projectID: module.projectID,
                        company: module.company,
                        executeJob: null,
                        adoTestRunId: 0,
                        // tpId: tp.tpId,
                        // testRun: newModules,
                    }).save()
                    await Job.findByIdAndUpdate(createdJob?._id, {
                        runningStatus: JobRunningStatus.MANUAL,
                        testRun: [newTestRun],
                    })
                    logger.info(`Created manual job`)
                    // })

                    // Ado Test Run Request
                    if (ADO_ENABLED) {
                        let project = await common.getProjectNameById(
                            release.projectID
                        )
                        const adoRunRequestBody = {
                            projectName: project.name,
                            testPlanName: release.releaseName,
                            testSuiteName: module.suiteName,
                            testRunName: `${module.suiteName}_Manual`,
                        }
                        const headers = {
                            'Content-Type': 'application/json',
                        }
                        const adoJob = await axios.post(
                            `${process.env.ADO_INTEGRATION_HOST}/api/test-runs/createAdoTestRun`,
                            adoRunRequestBody,
                            { headers }
                        )
                        logger.info(`Created manual job in ADO`)
                        await Job.findByIdAndUpdate(createdJob?._id, {
                            adoTestRunId: adoJob?.data?.id,
                        })
                    }
                    logger.info(`Created manual job`)
                } else if (
                    module?.automationStatus &&
                    testPlaceholders.length !== 0
                ) {
                    testPlaceholders?.forEach(async (tp, index) => {
                        createAutomationJenkinsJob(
                            module,
                            release,
                            userId,
                            newTestRun,
                            tp,
                            index,
                            status,
                            video
                        )
                    })
                } else if (
                    module?.automationStatus &&
                    testPlaceholders.length === 0
                ) {
                    createAutomationJenkinsJob(
                        module,
                        release,
                        userId,
                        newTestRun,
                        null,
                        0,
                        status
                    )
                }
            }
        })
    } catch (err) {
        logger.info('error in creating jenkins job', err)
    }
}

const updateTestCaseSteps = async (projectId, version, releaseId, jobId) => {
    try {
        const testCaseSteps = await TestCaseSteps.findOne({
            projectId,
            version,
        })
        let { releaseIds, jobIds } = testCaseSteps
        releaseIds.push(releaseId)
        releaseIds = Array.from(new Set(releaseIds))
        jobIds.push(jobId)
        jobIds = Array.from(new Set(jobIds))
        await TestCaseSteps.findOneAndUpdate(
            { projectId, version },
            { releaseIds, jobIds }
        )
    } catch (err) {}
}

const createAutomationJenkinsJob = async (
    module,
    release,
    userId,
    newTestRun,
    tp,
    index,
    status,
    video
) => {
    logger.info(`Creating automation job with TODO status`)
    const createdJob = await new Job({
        jenkinsJobID: JobRunningStatus.TODO,
        jenkinsPath: JobRunningStatus.TODO,
        releaseID: release._id,
        createdBy: userId,
        dependsOn: null,
        video,
        runningStatus: JobRunningStatus.TODO,
        executeJob: null,
        version: release?.testRunVersion,
        jenkinsJobName: '',
        tpId: tp?.tpId,
        projectID: module.projectID,
        company: module.company,
    }).save()

    logger.info(`Created automation job ${createdJob} with TODO status`)

    if (createdJob) {
        const createdJobId = createdJob._id.toString()
        try {
            // await Job.findByIdAndUpdate(createdJobId, {
            //     runningStatus: JobRunningStatus.TODO,
            //     testRun: [newTestRun],
            // })
            await Job.findByIdAndUpdate(
                createdJobId,
                {
                    $push: {
                        testRun: {
                            $each: [newTestRun], // ensures it's always pushed as one object
                        },
                    },
                    $set: {
                        runningStatus: JobRunningStatus.TODO,
                    },
                },
                {
                    new: true,
                    runValidators: true,
                }
            )

            const project = await Project.findById(module.projectID, {
                testCaseSteps: 1,
            })

            await updateTestCaseSteps(
                project?._id,
                project?.testCaseSteps?.version,
                release._id,
                createdJobId
            )

            await Release.findOneAndUpdate(
                { _id: release?._id },
                {
                    $set: {
                        'modules.$[module].testPlaceholders.$[tp].jobId':
                            createdJobId,
                    },
                },
                {
                    arrayFilters: [
                        { 'module.moduleID': newTestRun?.moduleID },
                        { 'tp.tpId': tp?.tpId },
                    ],
                    upsert: true,
                    new: true,
                }
            )
        } catch (error) {
            console.log('automation error', error)
        }
        if (module.automationStatus) {
            const templateID = release?.templateID
            if (templateID) {
                const template = await Template.findById(templateID)
                if (template) {
                    jenkinsConfig.parentProject = getJobName(template.name)
                    jenkinsConfig.endpoint = template.endpoint
                    jenkinsConfig.headers.Authorization = `Basic ${Buffer.from(
                        `${template.username}:${template.password}`
                    ).toString('base64')}`
                }
            }

            const crumbResponse = await axios.get(jenkinsConfig.getCrumb(), {
                headers: {
                    Authorization: jenkinsConfig.headers.Authorization,
                },
            })

            jenkinsConfig.headers['Jenkins-Crumb'] = crumbResponse.data.crumb
            const jobName = `${release?.releaseName}_${module?.suiteName}_${index + 1}`
            try {
                await axios.post(
                    jenkinsConfig.createItem(jobName),
                    {},
                    { headers: jenkinsConfig.headers }
                )
            } catch (err) {
                logger.info(err)
            }

            try {
                await axios.post(
                    jenkinsConfig.disableJob(jobName),
                    {},
                    { headers: jenkinsConfig.headers }
                )
            } catch (err) {
                logger.info(err)
            }

            try {
                await axios.post(
                    jenkinsConfig.enableJob(jobName),
                    {},
                    { headers: jenkinsConfig.headers }
                )
            } catch (err) {
                logger.info(err)
            }

            if (!newTestRun?.dependsOn) {
                try {
                    const rjdata = await axios.post(
                        jenkinsConfig.runJob(jobName, createdJobId),
                        {},
                        { headers: jenkinsConfig.headers }
                    )
                    const locationItemRegex = /.*?\/queue\/item\/(\d+)\//g
                    const itemID = locationItemRegex.exec(
                        rjdata.headers.location
                    )[1]
                    await Job.findByIdAndUpdate(createdJobId, {
                        jenkinsJobID: itemID,
                        jenkinsPath: rjdata.headers.location,
                        runningStatus: status,
                    })

                    // Ado Test Run Request
                    if (ADO_ENABLED) {
                        let project = await common.getProjectNameById(
                            release.projectID
                        )
                        const adoRunRequestBody = {
                            projectName: project.name,
                            testPlanName: release.releaseName,
                            testSuiteName: module.suiteName,
                            testRunName: `${module.suiteName}_${itemID}`,
                        }
                        const headers = {
                            'Content-Type': 'application/json',
                        }
                        const adoJob = await axios.post(
                            `${process.env.ADO_INTEGRATION_HOST}/api/test-runs/createAdoTestRun`,
                            adoRunRequestBody,
                            { headers }
                        )
                        logger.info(`Created manual job in ADO`)
                        await Job.findByIdAndUpdate(createdJob?._id, {
                            adoTestRunId: adoJob?.data?.id,
                        })
                    }
                } catch (err) {
                    logger.info(err)
                }
            } else {
                const dJob = await Job.findOneAndUpdate(
                    {
                        releaseID: release?._id,
                        'testRun.moduleID': newTestRun?.dependsOn,
                        version: release?.testRunVersion,
                    },
                    {
                        executeJob: createdJobId,
                    }
                )

                await Job.findByIdAndUpdate(createdJobId, {
                    jenkinsJobID: JobRunningStatus.WAITING,
                    jenkinsPath: JobRunningStatus.WAITING,
                    runningStatus: JobRunningStatus.WAITING,
                    dependsOn: {
                        moduleId: newTestRun?.dependsOn,
                        jobId: dJob._id.toString(),
                    },
                })
            }
        }
    }
}

// TestResult creation
router.post('/v1/createJob/:releaseID', async (req, res) => {
    const warnings = []
    try {
        Release.findById(req.params.releaseID, (err, release) => {
            responseTransformer.passthroughError(
                err,
                release,
                'finding release',
                res,
                async (release) => {
                    const releaseModules = release.toObject()?.modules
                    const mids = releaseModules?.map(
                        (module) => module.moduleID
                    )
                    const moduleModal = await Module.find({
                        _id: { $in: mids },
                    })

                    const newReleaseModules = []
                    let updateRelease = false

                    const newTestRuns = await Promise.all(
                        moduleModal?.map(async (m) => {
                            const newModule = {}
                            const newReleaseModule = {}
                            const module = await Module.findOne(
                                {
                                    suiteName: m.suiteName,
                                    projectID: m.projectID,
                                },
                                {
                                    _id: 1,
                                    automationStatus: 1,
                                    testNodes: 1,
                                    testPlaceholders: 1,
                                    version: 1,
                                    createdAt: 1,
                                },
                                { sort: { createdAt: -1 } }
                            )

                            const { testNodes } = module
                            const rTestNodes = release
                            const releaseModule = releaseModules?.find(
                                (module) =>
                                    module.moduleID.toString() ===
                                    m._id.toString()
                            )
                            const rids = releaseModule?.testNodes
                            let mids = testNodes?.map((tNode) => tNode._id)
                            mids = rids?.filter((id) => mids.includes(id))
                            if (mids?.length === 0)
                                mids = testNodes?.map((tNode) => tNode._id)
                            newModule.moduleID = module?._id
                            newModule.testNodes = mids
                            newModule.testPlaceholders =
                                module?.testPlaceholders

                            let testRunModule

                            if (m._id.toString() !== module._id.toString()) {
                                testRunModule =
                                    responseTransformer.getTestRunModuleWithSteps(
                                        module,
                                        mids,
                                        null
                                    )

                                const tps = releaseModule.testPlaceholders

                                tps.forEach((tp, index) => {
                                    newReleaseModule.moduleID =
                                        module._id.toString()
                                    const newTp = {
                                        ...module.testPlaceholders[index],
                                        jobId: tp.jobId,
                                        tpId: tp.tpId,
                                        testRunProcessed: tp.testRunProcessed,
                                    }
                                    newReleaseModule.testPlaceholders = [newTp]
                                    newReleaseModule.testNodes = mids
                                    newReleaseModules.push(newReleaseModule)
                                })

                                updateRelease = true
                            } else {
                                testRunModule =
                                    responseTransformer.getTestRunModuleWithSteps(
                                        m,
                                        rids,
                                        null
                                    )

                                const tps = releaseModule.testPlaceholders
                                const newTps = []
                                tps.forEach((tp, index) => {
                                    newReleaseModule.moduleID = m._id.toString()
                                    const newTp = {
                                        ...m.testPlaceholders[index],
                                        jobId: tp.jobId,
                                        tpId: tp.tpId,
                                        testRunProcessed: tp.testRunProcessed,
                                    }
                                    newReleaseModule.testPlaceholders = [newTp]
                                    newReleaseModule.testNodes = rids
                                    newReleaseModules.push(newReleaseModule)
                                })
                            }

                            return testRunModule
                        })
                    )

                    if (updateRelease) {
                        Release.findByIdAndUpdate(
                            release?._id,
                            {
                                modules: newReleaseModules,
                                createdAt: release?.createdAt,
                                updatedAt: release?.updatedAt,
                            },
                            (err, updatedRelease) => {
                                if (err) {
                                    logger.info('Updated Release failed', err)
                                } else {
                                    logger.info(
                                        'release updated',
                                        updatedRelease
                                    )
                                    release = updatedRelease
                                }
                            }
                        )
                    }
                    createJenkinsJob(
                        release,
                        newTestRuns,
                        req.userId || req.body.userId,
                        JobRunningStatus.IN_QUEUE
                    )
                    res.send({
                        status: 200,
                        message: 'Create Job Success',
                        data: {},
                    })
                }
            )
        })
    } catch (error) {
        logger.warn(`Encountered warnings while serving request: ${warnings}`)
        res.send({ status: 400, message: 'Bad Request', data: error, warnings })
    }
})

const hasCommonElements = (arr1, arr2) => {
    for (let element of arr1) {
        if (arr2.includes(element)) {
            return true
        }
    }
    return false
}

router.post('/v2/createJob/:releaseID', async (req, res) => {
    const warnings = []
    try {
        const release = await Release.findById(req.params.releaseID)
        responseTransformer.passthroughError(
            null,
            release,
            'finding release',
            res,
            async (release) => {
                const releaseModules = release.toObject()?.modules
                const mids = releaseModules?.map((module) => module.moduleID)
                const moduleModal = await Module.find({
                    _id: { $in: mids },
                })

                const newReleaseModules = []
                let updateRelease = false

                const releaseModulesQuery = moduleModal?.map((module) => {
                    return {
                        suiteName: module.suiteName,
                        projectID: module.projectID,
                    }
                })

                console.log('releaseModulesQuery', releaseModulesQuery)

                let modulesData = await Module.find({
                    $or: releaseModulesQuery,
                }).sort({ createdAt: -1 })

                modulesData = await responseTransformer.getModulesDataWithSteps(
                    modulesData,
                    modulesData[0].projectID,
                    null,
                    null,
                    true,
                    false
                )

                console.log('modulesData', modulesData)

                const newTestRuns = await Promise.all(
                    moduleModal?.map(async (m) => {
                        const newModule = {}
                        const newReleaseModule = {}

                        let module = modulesData?.filter(
                            (module) =>
                                module.suiteName === m.suiteName &&
                                module.projectID === m.projectID
                        )
                        module = module[0]
                        console.log('module', module)

                        const relModule = releaseModules.filter(
                            (rModule) =>
                                rModule.moduleID.toString() === m._id.toString()
                        )

                        const { testNodes } = module
                        let tags = relModule[0]?.tags
                        let dependsOn = relModule[0]?.dependsOn

                        const filteredtestNodes = []

                        if (tags) {
                            testNodes?.map((tNode) => {
                                const node = tNode.testNode[0]
                                const nodeTags = node.tags

                                if (tags.length === 0) {
                                    const moduleTags = [
                                        ...new Set(
                                            module?.testNodes
                                                ?.map((m) => m.testNode[0].tags)
                                                .flat()
                                        ),
                                    ]
                                    tags = moduleTags
                                }

                                if (hasCommonElements(tags, nodeTags)) {
                                    filteredtestNodes.push(tNode)
                                }
                            })
                        }

                        const rTestNodes = release
                        const releaseModule = releaseModules?.find(
                            (module) =>
                                module.moduleID.toString() === m._id.toString()
                        )
                        const rids = releaseModule?.testNodes
                        let mids = filteredtestNodes?.map((tNode) => tNode._id)
                        mids = rids?.filter((id) => mids.includes(id))
                        if (mids?.length === 0)
                            mids = filteredtestNodes?.map((tNode) => tNode._id)

                        newModule.moduleID = module?._id
                        newModule.tags = tags
                        newModule.dependsOn = releaseModule?.dependsOn
                        newModule.testNodes = mids
                        newModule.testPlaceholders = module?.testPlaceholders

                        let testRunModule

                        if (m._id.toString() !== module._id.toString()) {
                            testRunModule =
                                responseTransformer.getTestRunModuleWithSteps(
                                    module,
                                    mids,
                                    tags,
                                    dependsOn
                                )

                            const tps =
                                releaseModule.testPlaceholders?.length !== 0
                                    ? releaseModule.testPlaceholders
                                    : module?.testPlaceholders

                            newReleaseModule.moduleID = module._id.toString()

                            const newTps = tps.map((tp, index) => {
                                const newTp = {
                                    ...module.testPlaceholders[index],
                                    jobId: tp.jobId,
                                    tpId: tp.tpId,
                                    testRunProcessed: tp.testRunProcessed,
                                }
                                return newTp
                            })
                            newReleaseModule.testPlaceholders = newTps
                            newReleaseModule.testNodes = mids
                            newReleaseModule.tags = tags
                            newReleaseModule.dependsOn =
                                releaseModule?.dependsOn
                            newReleaseModules.push(newReleaseModule)

                            updateRelease = true
                        } else {
                            testRunModule =
                                responseTransformer.getTestRunModuleWithSteps(
                                    module,
                                    rids,
                                    tags,
                                    dependsOn
                                )

                            const tps =
                                releaseModule.testPlaceholders?.length !== 0
                                    ? releaseModule.testPlaceholders
                                    : module?.testPlaceholders
                            newReleaseModule.moduleID = m._id.toString()
                            const newTps = tps?.map((tp, index) => {
                                const newTp = {
                                    ...m.testPlaceholders[index],
                                    jobId: tp.jobId,
                                    tpId: tp.tpId,
                                    testRunProcessed: tp.testRunProcessed,
                                }
                                return newTp
                            })

                            newReleaseModule.testPlaceholders = newTps
                            newReleaseModule.testNodes = rids
                            newReleaseModule.tags = tags
                            newReleaseModule.dependsOn =
                                releaseModule?.dependsOn
                            newReleaseModules.push(newReleaseModule)
                        }

                        return testRunModule
                    })
                )

                if (updateRelease) {
                    const updatedRelease = await Release.findByIdAndUpdate(
                        release?._id,
                        {
                            modules: newReleaseModules,
                            createdAt: release?.createdAt,
                            updatedAt: release?.updatedAt,
                        },
                        { new: true }
                    )
                    if (!updatedRelease) {
                        logger.info('Release not found for update')
                    } else {
                        logger.info('release updated', updatedRelease)
                        release = updatedRelease
                    }
                }

                createJenkinsJob(
                    release,
                    newTestRuns,
                    req.userId || req.body.userId,
                    JobRunningStatus.IN_QUEUE,
                    req.body.video
                )
                res.send({
                    status: 200,
                    message: 'Create Job Success',
                    data: {},
                })
            }
        )
    } catch (error) {
        logger.info(`Error while creating job ${error}`)
        logger.warn(`Encountered warnings while serving request: ${warnings}`)
        res.send({ status: 400, message: 'Bad Request', data: error, warnings })
    }
})

router.post('/v1/runJob/:jobId', async (req, res) => {
    const warnings = []
    try {
        const job = await Job.findById(req.params.jobId)
        if (!job) {
            return res.status(404).send({ message: 'Job not found' })
        }

        const release = await Release.findById(job.releaseID)
        const templateID = release?.templateID

        if (templateID) {
            const template = await Template.findById(templateID)
            if (template) {
                jenkinsConfig.parentProject = getJobName(template.name)
                jenkinsConfig.endpoint = template.endpoint
                jenkinsConfig.headers.Authorization = `Basic ${Buffer.from(
                    `${template.username}:${template.password}`
                ).toString('base64')}`
            }
        }

        const crumbResponse = await axios.get(jenkinsConfig.getCrumb(), {
            headers: { Authorization: jenkinsConfig.headers.Authorization },
        })

        const module = await Module.findById(job?.testRun?.[0]?.moduleID)

        jenkinsConfig.headers['Jenkins-Crumb'] = crumbResponse.data.crumb
        const jobName = `${release?.releaseName}_${module?.suiteName}_1`

        try {
            const rjdata = await axios.post(
                jenkinsConfig.runJob(jobName, job._id),
                {},
                { headers: jenkinsConfig.headers }
            )

            const locationItemRegex = /.*?\/queue\/item\/(\d+)\//
            const itemMatch = locationItemRegex.exec(rjdata.headers.location)
            const itemID = itemMatch ? itemMatch[1] : null

            await Job.findByIdAndUpdate(job._id, {
                jenkinsJobID: itemID,
                jenkinsPath: rjdata.headers.location,
                runningStatus: JobRunningStatus.IN_QUEUE,
            })

            return res.send({
                status: 200,
                message: 'Create Job Success',
                data: {},
            })
        } catch (err) {
            logger.error('Jenkins job trigger failed:', err)
            return res
                .status(500)
                .send({ message: 'Failed to trigger Jenkins job' })
        }
    } catch (err) {
        logger.error('Error running job:', err)
        return res.status(500).send({ message: 'Internal Server Error' })
    }
})

const getReleaseModuleData = () => {}

router.get('/v2/getReleaseStatus/:releaseId', async (req, res) => {
    const releaseId = req.params.releaseId // Assume releaseId is passed as a query parameter
    try {
        const release = await Release.findOne(
            { _id: releaseId },
            { releaseName: 1, modules: 1, testRunVersion: 1 }
        )
        if (!release) {
            return res.status(404).send({ message: 'Release not found' })
        } else {
            let response = []
            let modulesdata = []
            let counts = []
            let relCounts = []
            let rTestNodes = []
            for (let i = 0; i < release.modules.length; i++) {
                let releasetestnodes = release.modules[i].testNodes

                const modules = await Module.find(
                    { _id: release.modules[i].moduleID },
                    { _id: 1, suiteName: 1, testNodes: 1, testPlaceholders: 1 }
                )
                let query = {
                    releaseID: releaseId,
                    'testRun.moduleID': release.modules[i].moduleID,
                    version: release.testRunVersion,
                }
                const jobs = await Job.find(query, {
                    _id: 1,
                    testRun: 1,
                    version: 1,
                    runningStatus: 1,
                }).sort({ createdAt: -1 })

                let testNodes = []
                counts = []

                for (let mt = 0; mt < modules[0].testNodes.length; mt++) {
                    for (let rtn = 0; rtn < releasetestnodes.length; rtn++) {
                        if (
                            releasetestnodes[rtn] ==
                            modules[0].testNodes[mt]._id
                        ) {
                            // testNodes = []
                            let formattedDuration = ''
                            if (
                                jobs[0]?.testRun[0]?.testNodes[rtn]
                                    ?.executionDuration
                            ) {
                                const exeduration = new Date(
                                    jobs[0].testRun[0].testNodes[
                                        rtn
                                    ].executionDuration
                                )
                                formattedDuration =
                                    parseInt(exeduration.getMinutes(), 10) !== 0
                                        ? moment(exeduration).format(
                                              'm[m] s[s]'
                                          )
                                        : moment(exeduration).format('s[s]')
                            }

                            let testStepStatuses = []
                            if (jobs.length !== 0) {
                                testStepStatuses =
                                    jobs[0].testRun[0].testNodes[rtn]
                                        ?.testCaseSteps
                            } else {
                                testStepStatuses =
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseSteps
                            }
                            testNodes.push({
                                _id: modules[0].testNodes[mt].testNode[0]._id,
                                id: `${modules[0].testNodes[mt].testNode[0]._id}`,
                                suiteName: modules[0].suiteName,
                                testCaseTitle:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseTitle,
                                testCaseDescription:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseDescription,
                                testCaseID:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseID,
                                tags: modules[0].testNodes[mt].testNode[0].tags,
                                automationStatus:
                                    modules[0].testNodes[mt].testNode[0]
                                        .automationStatus,
                                testCaseSteps:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseSteps,
                                testStepStatuses,
                                status:
                                    jobs.length > 0
                                        ? jobs[0].testRun[0].testNodes[rtn]
                                              ?.status
                                        : JobStatus.UNTESTED,
                                executionStart:
                                    jobs.length > 0
                                        ? jobs[0].testRun[0].testNodes[rtn]
                                              ?.executionStart
                                        : '',
                                executionEnd:
                                    jobs.length > 0
                                        ? jobs[0].testRun[0].testNodes[rtn]
                                              ?.executionEnd
                                        : '',
                                executionDuration: formattedDuration,
                            })
                        }
                    }
                }
                let statusCounts
                let formattedDuration = ''

                jobs?.forEach((job) => {
                    if (job?.testRun[0]?.executionStart) {
                        statusCounts = responseTransformer.getStatusCounts(
                            job?.testRun
                        )
                        counts.push(statusCounts)

                        if (job?.testRun[0]?.executionDuration) {
                            const exeduration = new Date(
                                jobs[0].testRun[0].executionDuration
                            )
                            formattedDuration =
                                parseInt(exeduration.getMinutes(), 10) !== 0
                                    ? moment(exeduration).format('m[m] s[s]')
                                    : moment(exeduration).format('s[s]')
                        }
                    } else {
                        statusCounts = {
                            total: testNodes?.length,
                            untested: testNodes?.length,
                            passed: 0,
                            skipped: 0,
                            failed: 0,
                            ignored: 0,
                            warning: 0,
                            percentage: 0,
                        }
                        counts.push(statusCounts)
                    }
                })

                const mCounts =
                    responseTransformer.getReleaseStatusCounts(counts)
                relCounts.push(mCounts)

                let mTestNodes = []

                await Promise.all(
                    release.modules[i].testPlaceholders?.map(
                        async (tp, index) => {
                            const job = await Job.findById(tp.jobId)

                            if (job?.testRun[0]?.executionDuration) {
                                const exeduration = new Date(
                                    job.testRun[0].executionDuration
                                )
                                const duration =
                                    parseInt(exeduration.getMinutes(), 10) !== 0
                                        ? moment(exeduration).format(
                                              'm[m] s[s]'
                                          )
                                        : moment(exeduration).format('s[s]')
                            }

                            const newTp = { ...tp }
                            delete newTp.jobId
                            delete newTp.tpId
                            delete newTp.testRunProcessed

                            let data =
                                responseTransformer.getModuleStatusCounts(
                                    modules,
                                    releasetestnodes,
                                    job
                                )
                            if (index === 0) {
                                mTestNodes = data.testNodes
                            }

                            modulesdata.push({
                                _id: `${modules[0]._id}_${tp.tpId}`,
                                moduleName: modules[0].suiteName,
                                testNodes: data.testNodes,
                                testPlaceholders: [tp],
                                executionStart:
                                    jobs.length > 0
                                        ? jobs[0]?.testRun[0]?.executionStart
                                        : '',
                                executionEnd:
                                    modules.length > 0
                                        ? jobs[0]?.testRun[0]?.executionEnd
                                        : '',
                                executionDuration: data.formattedDuration,
                                graphTestCases: {
                                    total:
                                        data?.counts?.length !== 0
                                            ? data?.counts?.total
                                            : data?.testNodes?.length,
                                    untested:
                                        data?.counts.length !== 0
                                            ? data?.counts?.untested
                                            : data?.countstestNodes?.length,
                                    passed:
                                        data?.counts.length !== 0
                                            ? data?.counts?.passed
                                            : 0,
                                    skipped:
                                        data?.counts.length !== 0
                                            ? data?.counts?.skipped
                                            : 0,
                                    ignored:
                                        data?.counts.length !== 0
                                            ? data?.counts?.ignored
                                            : 0,
                                    warning:
                                        data?.counts.length !== 0
                                            ? data?.counts?.warning
                                            : 0,
                                    failed:
                                        data?.counts.length !== 0
                                            ? data?.counts?.failed
                                            : 0,
                                    blocked: 0,
                                    percentage:
                                        data?.counts.length !== 0
                                            ? data?.counts?.percentage
                                            : 0,
                                },
                            })
                        }
                    )
                )

                const moduleDuration = await getReleaseModuleExecutionDuration(
                    release,
                    release?.testRunVersion,
                    modules[0]._id
                )

                if (mTestNodes.length === 0) mTestNodes = testNodes

                modulesdata.push({
                    _id: modules[0]._id,
                    suiteName: modules[0].suiteName,
                    testNodes: mTestNodes,
                    testPlaceholders: release.modules[i].testPlaceholders,
                    executionStart:
                        jobs.length > 0
                            ? jobs[0]?.testRun[0]?.executionStart
                            : '',
                    executionEnd:
                        modules.length > 0
                            ? jobs[0]?.testRun[0]?.executionEnd
                            : '',
                    executionDuration: moduleDuration,
                    graphTestCases: {
                        total:
                            mCounts.length !== 0
                                ? mCounts?.total
                                : mTestNodes?.length,
                        untested:
                            mCounts.length !== 0
                                ? mCounts?.untested
                                : mTestNodes?.length,
                        passed: mCounts.length !== 0 ? mCounts?.passed : 0,
                        skipped: mCounts.length !== 0 ? mCounts?.skipped : 0,
                        failed: mCounts.length !== 0 ? mCounts?.failed : 0,
                        ignored: mCounts.length !== 0 ? mCounts?.ignored : 0,
                        warning: mCounts.length !== 0 ? mCounts?.warning : 0,
                        blocked: 0,
                        percentage:
                            mCounts.length !== 0 ? mCounts?.percentage : 0,
                    },
                })

                rTestNodes = [...rTestNodes, ...mTestNodes]
            }
            const rCounts =
                responseTransformer.getReleaseStatusCounts(relCounts)
            const executionDuration = await getReleaseExecutionDuration(
                release,
                release?.testRunVersion
            )
            const releaseModuleData = {
                _id: releaseId,
                testNodes: rTestNodes,
                graphTestCases: {
                    total:
                        counts?.length !== 0
                            ? rCounts?.total
                            : rTestNodes.length,
                    untested:
                        counts?.length !== 0
                            ? rCounts?.untested
                            : rTestNodes.length,
                    passed: counts?.length !== 0 ? rCounts?.passed : 0,
                    skipped: counts?.length !== 0 ? rCounts?.skipped : 0,
                    failed: counts?.length !== 0 ? rCounts?.failed : 0,
                    blocked: 0,
                    ignored: counts?.length !== 0 ? rCounts?.ignored : 0,
                    warning: counts?.length !== 0 ? rCounts?.warning : 0,
                    percentage: counts?.length !== 0 ? rCounts?.percentage : 0,
                },
                executionDuration,
            }
            modulesdata.push(releaseModuleData)
            response = {
                _id: releaseId,
                releaseName: release?.releaseName,
                suiteName: 'All Modules',
                modules: modulesdata,
            }
            res.status(200).send({ message: 'Data Avaiable', data: response })
        }
    } catch (error) {
        console.error(error)
        res.status(500).send({
            message: 'An error occurred while fetching data',
        })
    }
})

router.get('/v3/getReleaseStatus/:releaseId', async (req, res) => {
    const releaseId = req.params.releaseId // Assume releaseId is passed as a query parameter
    try {
        const release = await Release.findOne(
            { _id: releaseId },
            { releaseName: 1, modules: 1, testRunVersion: 1 }
        )
        if (!release) {
            return res.status(404).send({ message: 'Release not found' })
        } else {
            let response = []
            let modulesdata = []
            let counts = []
            let relCounts = []
            let rTestNodes = []
            let skipExecutionDuration = false

            const moduleIDs = release.modules.map((module) => module.moduleID)

            let modulesData = await Module.find(
                { _id: { $in: moduleIDs } }, // Find multiple moduleIDs
                {
                    _id: 1,
                    suiteName: 1,
                    testNodes: 1,
                    testPlaceholders: 1,
                    projectID: 1,
                }
            )

            modulesData = await responseTransformer.getModulesDataWithSteps(
                modulesData,
                modulesData[0].projectID,
                releaseId,
                null
            )

            let query = {
                releaseID: releaseId,
                version: release.testRunVersion,
            }
            const jobsData = await Job.find(query, {
                _id: 1,
                testRun: 1,
                version: 1,
                runningStatus: 1,
            }).sort({ createdAt: -1 })

            let latestJob
            for (let i = 0; i < release.modules.length; i++) {
                let releasetestnodes = release.modules[i].testNodes
                let releaseTags = release.modules[i].tags
                const jobs = jobsData.filter(
                    (job) =>
                        job.testRun[0].moduleID === release.modules[i].moduleID
                )

                if (jobs) latestJob = jobs[0]

                let testNodes = []
                let fetchStatusCounts = false
                counts = []
                const modules = modulesData.filter(
                    (module) =>
                        module._id.toString() ===
                        release.modules[i].moduleID.toString()
                )

                for (let mt = 0; mt < modules[0].testNodes.length; mt++) {
                    for (let rtn = 0; rtn < releasetestnodes.length; rtn++) {
                        if (
                            releasetestnodes[rtn] ==
                            modules[0].testNodes[mt]._id
                        ) {
                            // testNodes = []
                            let formattedDuration = ''
                            if (
                                jobs[0]?.testRun[0]?.testNodes[rtn]
                                    ?.executionDuration
                            ) {
                                const exeduration = new Date(
                                    jobs[0].testRun[0].testNodes[
                                        rtn
                                    ].executionDuration
                                )
                                formattedDuration =
                                    parseInt(exeduration.getMinutes(), 10) !== 0
                                        ? moment(exeduration).format(
                                              'm[m] s[s]'
                                          )
                                        : moment(exeduration).format('s[s]')
                            }

                            let testStepStatuses = []
                            if (jobs.length !== 0) {
                                testStepStatuses =
                                    jobs[0].testRun[0].testNodes[rtn]
                                        ?.testCaseSteps
                            } else {
                                testStepStatuses =
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseSteps
                            }
                            testNodes.push({
                                _id: modules[0].testNodes[mt].testNode[0]._id,
                                id: `${modules[0].testNodes[mt].testNode[0]._id}`,
                                suiteName: modules[0].suiteName,
                                testCaseTitle:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseTitle,
                                testCaseDescription:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseDescription,
                                testCaseID:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseID,
                                tags: modules[0].testNodes[mt].testNode[0].tags,
                                automationStatus:
                                    modules[0].testNodes[mt].testNode[0]
                                        .automationStatus,
                                testCaseSteps:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseSteps,
                                testStepStatuses,
                                status:
                                    jobs.length > 0
                                        ? jobs[0].testRun[0].testNodes[rtn]
                                              ?.status
                                        : JobStatus.UNTESTED,
                                executionStart:
                                    jobs.length > 0
                                        ? jobs[0].testRun[0].testNodes[rtn]
                                              ?.executionStart
                                        : '',
                                executionEnd:
                                    jobs.length > 0
                                        ? jobs[0].testRun[0].testNodes[rtn]
                                              ?.executionEnd
                                        : '',
                                executionDuration: formattedDuration,
                            })

                            if (jobs.length > 0) {
                                const status =
                                    jobs[0].testRun[0].testNodes[rtn]?.status
                                if (status !== JobStatus.UNTESTED)
                                    fetchStatusCounts = true
                            }
                        }
                    }
                }
                let statusCounts
                let formattedDuration = ''

                const jobTags = jobs[0]?.testRun[0]?.tags
                jobs?.forEach((job) => {
                    if (releaseTags.length === 0) {
                        const moduleTags = [
                            ...new Set(
                                modules[0]?.testNodes
                                    ?.map((m) => m.testNode[0].tags)
                                    .flat()
                            ),
                        ]
                        releaseTags = moduleTags
                    }
                    skipExecutionDuration =
                        releaseTags?.sort().toString() ==
                        jobTags?.sort().toString()

                    if (
                        (job?.testRun[0]?.executionStart &&
                            skipExecutionDuration) ||
                        !jobTags ||
                        fetchStatusCounts
                    ) {
                        statusCounts = responseTransformer.getStatusCounts(
                            job?.testRun
                        )
                        counts.push(statusCounts)

                        if (job?.testRun[0]?.executionDuration) {
                            const exeduration = new Date(
                                jobs[0].testRun[0].executionDuration
                            )
                            formattedDuration =
                                parseInt(exeduration.getMinutes(), 10) !== 0
                                    ? moment(exeduration).format('m[m] s[s]')
                                    : moment(exeduration).format('s[s]')
                        }
                    } else {
                        statusCounts = {
                            total: testNodes?.length,
                            untested: testNodes?.length,
                            passed: 0,
                            skipped: 0,
                            failed: 0,
                            ignored: 0,
                            warning: 0,
                            percentage: 0,
                        }
                        counts.push(statusCounts)
                    }
                })
                const mCounts =
                    responseTransformer.getReleaseStatusCounts(counts)
                relCounts.push(mCounts)
                let mTestNodes = []

                await Promise.all(
                    release.modules[i].testPlaceholders?.map(
                        async (tp, index) => {
                            const job = await Job.findById(tp.jobId)

                            if (job?.testRun[0]?.executionDuration) {
                                const exeduration = new Date(
                                    job.testRun[0].executionDuration
                                )
                                const duration =
                                    parseInt(exeduration.getMinutes(), 10) !== 0
                                        ? moment(exeduration).format(
                                              'm[m] s[s]'
                                          )
                                        : moment(exeduration).format('s[s]')
                            }

                            const newTp = { ...tp }
                            delete newTp.jobId
                            delete newTp.tpId
                            delete newTp.testRunProcessed

                            let data =
                                responseTransformer.getModuleStatusCounts(
                                    modules,
                                    releasetestnodes,
                                    job
                                )
                            if (index === 0) {
                                mTestNodes = data.testNodes
                            }

                            modulesdata.push({
                                _id: `${modules[0]._id}_${tp.tpId}`,
                                moduleName: modules[0].suiteName,
                                testNodes: data.testNodes,
                                testPlaceholders: [tp],
                                executionStart:
                                    jobs.length > 0
                                        ? jobs[0]?.testRun[0]?.executionStart
                                        : '',
                                executionEnd:
                                    modules.length > 0
                                        ? jobs[0]?.testRun[0]?.executionEnd
                                        : '',
                                executionDuration: skipExecutionDuration
                                    ? data.formattedDuration
                                    : null,
                                graphTestCases: {
                                    total:
                                        data?.counts?.length !== 0
                                            ? data?.counts?.total
                                            : data?.testNodes?.length,
                                    untested:
                                        data?.counts.length !== 0
                                            ? data?.counts?.untested
                                            : data?.countstestNodes?.length,
                                    passed:
                                        data?.counts.length !== 0
                                            ? data?.counts?.passed
                                            : 0,
                                    skipped:
                                        data?.counts.length !== 0
                                            ? data?.counts?.skipped
                                            : 0,
                                    failed:
                                        data?.counts.length !== 0
                                            ? data?.counts?.failed
                                            : 0,
                                    ignored:
                                        data?.counts.length !== 0
                                            ? data?.counts?.ignored
                                            : 0,
                                    warning:
                                        data?.counts.length !== 0
                                            ? data?.counts?.warning
                                            : 0,
                                    blocked: 0,
                                    percentage:
                                        data?.counts.length !== 0
                                            ? data?.counts?.percentage
                                            : 0,
                                },
                            })
                        }
                    )
                )

                const moduleDuration = await getReleaseModuleExecutionDuration(
                    release,
                    release?.testRunVersion,
                    modules[0]._id
                )

                if (mTestNodes.length === 0) mTestNodes = testNodes
                const mCountsExists = parseInt(mCounts?.total, 10) !== 0
                modulesdata.push({
                    _id: modules[0]._id,
                    suiteName: modules[0].suiteName,
                    testNodes: mTestNodes,
                    testPlaceholders: release.modules[i].testPlaceholders,
                    executionStart:
                        jobs.length > 0
                            ? jobs[0]?.testRun[0]?.executionStart
                            : '',
                    executionEnd:
                        modules.length > 0
                            ? jobs[0]?.testRun[0]?.executionEnd
                            : '',
                    executionDuration: skipExecutionDuration
                        ? moduleDuration
                        : null,
                    graphTestCases: {
                        total: mCountsExists
                            ? mCounts?.total
                            : mTestNodes?.length,
                        untested: mCountsExists
                            ? mCounts?.untested
                            : mTestNodes?.length,
                        passed: mCountsExists ? mCounts?.passed : 0,
                        skipped: mCountsExists ? mCounts?.skipped : 0,
                        failed: mCountsExists ? mCounts?.failed : 0,
                        ignored: mCountsExists ? mCounts?.ignored : 0,
                        warning: mCountsExists ? mCounts?.warning : 0,
                        blocked: 0,
                        percentage: mCountsExists ? mCounts?.percentage : 0,
                    },
                })

                rTestNodes = [...rTestNodes, ...mTestNodes]
            }

            const rCounts =
                responseTransformer.getReleaseStatusCounts(relCounts)
            const executionDuration = await getReleaseExecutionDuration(
                release,
                release?.testRunVersion
            )
            const releaseModuleData = {
                _id: releaseId,
                testNodes: rTestNodes,
                graphTestCases: {
                    total:
                        counts?.length !== 0
                            ? rCounts?.total
                            : rTestNodes.length,
                    untested:
                        counts?.length !== 0
                            ? rCounts?.untested
                            : rTestNodes.length,
                    passed: counts?.length !== 0 ? rCounts?.passed : 0,
                    skipped: counts?.length !== 0 ? rCounts?.skipped : 0,
                    failed: counts?.length !== 0 ? rCounts?.failed : 0,
                    ignored: counts?.length !== 0 ? rCounts?.ignored : 0,
                    warning: counts?.length !== 0 ? rCounts?.warning : 0,
                    blocked: 0,
                    percentage: counts?.length !== 0 ? rCounts?.percentage : 0,
                },
                executionDuration: skipExecutionDuration
                    ? executionDuration
                    : null,
            }
            modulesdata.push(releaseModuleData)
            response = {
                _id: releaseId,
                releaseName: release?.releaseName,
                suiteName: 'All Modules',
                modules: modulesdata,
                runningStatus: latestJob?.runningStatus,
            }
            // Remove keys where value is null, undefined, empty string, or spaces only
            Object.keys(response).forEach((key) => {
                if (
                    response[key] == null ||
                    response[key].toString().trim() === ''
                ) {
                    delete response[key]
                }
            })
            res.status(200).send({ message: 'Data Avaiable', data: response })
        }
    } catch (error) {
        console.error(error)
        res.status(500).send({
            message: 'An error occurred while fetching data',
        })
    }
})

router.get('/v4/getReleaseStatus/:releaseId', async (req, res) => {
    const releaseId = req.params.releaseId // Assume releaseId is passed as a query parameter
    try {
        const release = await Release.findOne(
            { _id: releaseId },
            { releaseName: 1, modules: 1, testRunVersion: 1 }
        )
        if (!release) {
            return res.status(404).send({ message: 'Release not found' })
        } else {
            let response = []
            let modulesdata = []
            let counts = []
            let relCounts = []
            let rTestNodes = []
            let skipExecutionDuration = false

            const moduleIDs = release.modules.map((module) => module.moduleID)

            const objectIds = moduleIDs.map((id) => new Types.ObjectId(id))

            let modulesData = await Module.find(
                { _id: { $in: objectIds } },
                {
                    suiteName: 1,
                    testPlaceholders: 1,
                    projectID: 1,
                    testNodes: 1,
                }
            )

            // Remove testCaseSteps in JS
            modulesData = modulesData.map((module) => {
                module.testNodes = module.testNodes.map((tn) => {
                    tn.testNode = tn.testNode.map((t) => {
                        // copy object to avoid mutation
                        const copy = { ...t }
                        delete copy.testCaseSteps // remove the field
                        return copy
                    })
                    return tn
                })
                return module
            })

            modulesData = await responseTransformer.getModulesDataWithSteps(
                modulesData,
                modulesData[0].projectID,
                releaseId,
                null,
                false
            )

            let query = {
                releaseID: releaseId,
                version: release.testRunVersion,
            }
            const jobsData = await Job.find(query, {
                _id: 1,
                testRun: 1,
                version: 1,
                runningStatus: 1,
            }).sort({ createdAt: -1 })

            let latestJob
            for (let i = 0; i < release.modules.length; i++) {
                let releasetestnodes = release.modules[i].testNodes
                let releaseTags = release.modules[i].tags
                const jobs = jobsData.filter(
                    (job) =>
                        job.testRun[0].moduleID === release.modules[i].moduleID
                )

                if (jobs) latestJob = jobs[0]

                let testNodes = []
                let fetchStatusCounts = false
                counts = []

                const modules = modulesData.filter(
                    (module) =>
                        module._id.toString() ===
                        release.modules[i].moduleID.toString()
                )

                for (let mt = 0; mt < modules[0].testNodes.length; mt++) {
                    for (let rtn = 0; rtn < releasetestnodes.length; rtn++) {
                        if (
                            releasetestnodes[rtn] ==
                            modules[0].testNodes[mt]._id
                        ) {
                            // testNodes = []
                            let formattedDuration = ''
                            if (
                                jobs[0]?.testRun[0]?.testNodes[rtn]
                                    ?.executionDuration
                            ) {
                                const exeduration = new Date(
                                    jobs[0].testRun[0].testNodes[
                                        rtn
                                    ].executionDuration
                                )
                                formattedDuration =
                                    parseInt(exeduration.getMinutes(), 10) !== 0
                                        ? moment(exeduration).format(
                                              'm[m] s[s]'
                                          )
                                        : moment(exeduration).format('s[s]')
                            }

                            testNodes.push({
                                _id: modules[0].testNodes[mt].testNode[0]._id,
                                id: `${modules[0].testNodes[mt].testNode[0]._id}`,
                                suiteName: modules[0].suiteName,
                                testCaseTitle:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseTitle,
                                testCaseDescription:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseDescription,
                                testCaseID:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseID,
                                tags: modules[0].testNodes[mt].testNode[0].tags,
                                automationStatus:
                                    modules[0].testNodes[mt].testNode[0]
                                        .automationStatus,

                                status:
                                    jobs.length > 0
                                        ? jobs[0].testRun[0].testNodes[rtn]
                                              ?.status
                                        : JobStatus.UNTESTED,
                                executionStart:
                                    jobs.length > 0
                                        ? jobs[0].testRun[0].testNodes[rtn]
                                              ?.executionStart
                                        : '',
                                executionEnd:
                                    jobs.length > 0
                                        ? jobs[0].testRun[0].testNodes[rtn]
                                              ?.executionEnd
                                        : '',
                                executionDuration: formattedDuration,
                            })

                            if (jobs.length > 0) {
                                const status =
                                    jobs[0].testRun[0].testNodes[rtn]?.status
                                if (status !== JobStatus.UNTESTED)
                                    fetchStatusCounts = true
                            }
                        }
                    }
                }

                let statusCounts
                let formattedDuration = ''

                const jobTags = jobs[0]?.testRun[0]?.tags
                jobs?.forEach((job) => {
                    if (releaseTags.length === 0) {
                        const moduleTags = [
                            ...new Set(
                                modules[0]?.testNodes
                                    ?.map((m) => m.testNode[0].tags)
                                    .flat()
                            ),
                        ]
                        releaseTags = moduleTags
                    }
                    skipExecutionDuration =
                        releaseTags?.sort().toString() ==
                        jobTags?.sort().toString()

                    if (
                        (job?.testRun[0]?.executionStart &&
                            skipExecutionDuration) ||
                        !jobTags ||
                        fetchStatusCounts
                    ) {
                        statusCounts = responseTransformer.getStatusCounts(
                            job?.testRun
                        )
                        counts.push(statusCounts)

                        if (job?.testRun[0]?.executionDuration) {
                            const exeduration = new Date(
                                jobs[0].testRun[0].executionDuration
                            )
                            formattedDuration =
                                parseInt(exeduration.getMinutes(), 10) !== 0
                                    ? moment(exeduration).format('m[m] s[s]')
                                    : moment(exeduration).format('s[s]')
                        }
                    } else {
                        statusCounts = {
                            total: testNodes?.length,
                            untested: testNodes?.length,
                            passed: 0,
                            skipped: 0,
                            failed: 0,
                            ignored: 0,
                            warning: 0,
                            percentage: 0,
                        }
                        counts.push(statusCounts)
                    }
                })
                const mCounts =
                    responseTransformer.getReleaseStatusCounts(counts)
                relCounts.push(mCounts)
                let mTestNodes = []

                await Promise.all(
                    release.modules[i].testPlaceholders?.map(
                        async (tp, index) => {
                            const job = await Job.findById(tp.jobId)

                            if (job?.testRun[0]?.executionDuration) {
                                const exeduration = new Date(
                                    job.testRun[0].executionDuration
                                )
                                const duration =
                                    parseInt(exeduration.getMinutes(), 10) !== 0
                                        ? moment(exeduration).format(
                                              'm[m] s[s]'
                                          )
                                        : moment(exeduration).format('s[s]')
                            }

                            const newTp = { ...tp }
                            delete newTp.jobId
                            delete newTp.tpId
                            delete newTp.testRunProcessed

                            let data =
                                responseTransformer.getModuleStatusCounts(
                                    modules,
                                    releasetestnodes,
                                    job,
                                    false
                                )
                            if (index === 0) {
                                mTestNodes = data.testNodes
                            }

                            modulesdata.push({
                                _id: `${modules[0]._id}_${tp.tpId}`,
                                moduleName: modules[0].suiteName,
                                testNodes: data.testNodes,
                                testPlaceholders: [tp],
                                executionStart:
                                    jobs.length > 0
                                        ? jobs[0]?.testRun[0]?.executionStart
                                        : '',
                                executionEnd:
                                    modules.length > 0
                                        ? jobs[0]?.testRun[0]?.executionEnd
                                        : '',
                                executionDuration: skipExecutionDuration
                                    ? data.formattedDuration
                                    : null,
                                graphTestCases: {
                                    total:
                                        data?.counts?.length !== 0
                                            ? data?.counts?.total
                                            : data?.testNodes?.length,
                                    untested:
                                        data?.counts.length !== 0
                                            ? data?.counts?.untested
                                            : data?.countstestNodes?.length,
                                    passed:
                                        data?.counts.length !== 0
                                            ? data?.counts?.passed
                                            : 0,
                                    skipped:
                                        data?.counts.length !== 0
                                            ? data?.counts?.skipped
                                            : 0,
                                    failed:
                                        data?.counts.length !== 0
                                            ? data?.counts?.failed
                                            : 0,
                                    ignored:
                                        data?.counts.length !== 0
                                            ? data?.counts?.ignored
                                            : 0,
                                    warning:
                                        data?.counts.length !== 0
                                            ? data?.counts?.warning
                                            : 0,
                                    blocked: 0,
                                    percentage:
                                        data?.counts.length !== 0
                                            ? data?.counts?.percentage
                                            : 0,
                                },
                            })
                        }
                    )
                )

                const moduleDuration = await getReleaseModuleExecutionDuration(
                    release,
                    release?.testRunVersion,
                    modules[0]._id
                )

                if (mTestNodes.length === 0) mTestNodes = testNodes
                const mCountsExists = parseInt(mCounts?.total, 10) !== 0
                modulesdata.push({
                    _id: modules[0]._id,
                    suiteName: modules[0].suiteName,
                    testNodes: mTestNodes,
                    testPlaceholders: release.modules[i].testPlaceholders,
                    executionStart:
                        jobs.length > 0
                            ? jobs[0]?.testRun[0]?.executionStart
                            : '',
                    executionEnd:
                        modules.length > 0
                            ? jobs[0]?.testRun[0]?.executionEnd
                            : '',
                    executionDuration: skipExecutionDuration
                        ? moduleDuration
                        : null,
                    graphTestCases: {
                        total: mCountsExists
                            ? mCounts?.total
                            : mTestNodes?.length,
                        untested: mCountsExists
                            ? mCounts?.untested
                            : mTestNodes?.length,
                        passed: mCountsExists ? mCounts?.passed : 0,
                        skipped: mCountsExists ? mCounts?.skipped : 0,
                        failed: mCountsExists ? mCounts?.failed : 0,
                        ignored: mCountsExists ? mCounts?.ignored : 0,
                        warning: mCountsExists ? mCounts?.warning : 0,
                        blocked: 0,
                        percentage: mCountsExists ? mCounts?.percentage : 0,
                    },
                })

                rTestNodes = [...rTestNodes, ...mTestNodes]
            }

            const rCounts =
                responseTransformer.getReleaseStatusCounts(relCounts)
            const executionDuration = await getReleaseExecutionDuration(
                release,
                release?.testRunVersion
            )
            const releaseModuleData = {
                _id: releaseId,
                testNodes: rTestNodes,
                graphTestCases: {
                    total:
                        counts?.length !== 0
                            ? rCounts?.total
                            : rTestNodes.length,
                    untested:
                        counts?.length !== 0
                            ? rCounts?.untested
                            : rTestNodes.length,
                    passed: counts?.length !== 0 ? rCounts?.passed : 0,
                    skipped: counts?.length !== 0 ? rCounts?.skipped : 0,
                    failed: counts?.length !== 0 ? rCounts?.failed : 0,
                    ignored: counts?.length !== 0 ? rCounts?.ignored : 0,
                    warning: counts?.length !== 0 ? rCounts?.warning : 0,
                    blocked: 0,
                    percentage: counts?.length !== 0 ? rCounts?.percentage : 0,
                },
                executionDuration: skipExecutionDuration
                    ? executionDuration
                    : null,
            }
            modulesdata.push(releaseModuleData)
            response = {
                _id: releaseId,
                releaseName: release?.releaseName,
                suiteName: 'All Modules',
                modules: modulesdata,
                runningStatus: latestJob?.runningStatus,
            }
            // Remove keys where value is null, undefined, empty string, or spaces only
            Object.keys(response).forEach((key) => {
                if (
                    response[key] == null ||
                    response[key].toString().trim() === ''
                ) {
                    delete response[key]
                }
            })
            res.status(200).send({ message: 'Data Avaiable', data: response })
        }
    } catch (error) {
        console.error(error)
        res.status(500).send({
            message: 'An error occurred while fetching data',
        })
    }
})

router.get(
    '/v1/getTestCaseDetails/:jobId/:moduleId/:testCaseId',
    async (req, res) => {
        const { jobId, moduleId, testCaseId } = req.params
        try {
            let response = []

            let modulesData = await Module.findById(moduleId, {
                testNodes: 1,
                projectID: 1,
            })

            // Assuming modulesData is a single module object
            modulesData.testNodes = modulesData.testNodes.map((tn) => {
                tn.testNode = tn.testNode.filter(
                    (t) =>
                        t._id.toString() === testCaseId ||
                        tn._id.toString() === testCaseId
                )
                return tn
            })

            // Optionally remove testNodes with empty testNode array
            modulesData.testNodes = modulesData.testNodes.filter(
                (tn) => tn.testNode.length > 0
            )

            modulesData = await responseTransformer.getModulesDataWithSteps(
                [modulesData],
                modulesData.projectID,
                null,
                null,
                true,
                false
            )

            let jobsData = null
            let sTestNodes = null

            if (jobId !== '0' && jobId !== 'undefined') {
                jobsData = await Job.findById(jobId, {
                    _id: 1,
                    testRun: 1,
                    version: 1,
                    runningStatus: 1,
                }).sort({ createdAt: -1 })

                sTestNodes = jobsData.testRun[0].testNodes

                sTestNodes = sTestNodes.filter(
                    (tn) =>
                        tn.testNodeID.toString() ===
                        modulesData[0].testNodes[0]._id.toString()
                )
            }

            const testCaseSteps =
                modulesData[0].testNodes[0]?.testNode[0].testCaseSteps

            let newTestCaseSteps = []

            for (let i = 0; i < testCaseSteps.length; i++) {
                const testCaseStep = testCaseSteps[i]
                const name = Object.keys(testCaseStep)[1]
                let description = responseTransformer.findValue(
                    testCaseStep,
                    KEYS.TESTSTEPDESCRIPTION
                )
                if (!description) description = name
                if (jobId !== '0' && jobId !== 'undefined') {
                    newTestCaseSteps.push({
                        _id: testCaseStep._id.toString(),
                        name,
                        description,
                        ...sTestNodes[0].testCaseSteps[i],
                    })
                } else {
                    newTestCaseSteps.push({
                        _id: testCaseStep._id.toString(),
                        name,
                        description,
                    })
                }
            }

            // response = {
            //     testCaseSteps:
            //         modulesData[0].testNodes[0]?.testNode[0].testCaseSteps,
            //     testStepStatuses: sTestNodes[0].testCaseSteps,
            // }

            const filteredSteps = newTestCaseSteps.filter(
                (step) => !ExcludeKeys.includes(step.name)
            )

            response = { testCaseSteps: filteredSteps }

            // Remove keys where value is null, undefined, empty string, or spaces only
            Object.keys(response).forEach((key) => {
                if (
                    response[key] == null ||
                    response[key].toString().trim() === ''
                ) {
                    delete response[key]
                }
            })
            res.status(200).send({
                message: 'Data Avaiable',
                data: response,
            })
        } catch (error) {
            console.error(error)
            res.status(500).send({
                message: 'An error occurred while fetching data',
            })
        }
    }
)

router.get('/v2/getTestRunStatus/:jobId', async (req, res) => {
    const jobId = req.params.jobId // Assume releaseId is passed as a query parameter
    try {
        const job = await Job.findOne(
            { _id: jobId },
            { _id: 1, testRun: 1, version: 1, runningStatus: 1, releaseID: 1 }
        )
        const release = await Release.findOne(
            { _id: job?.releaseID },
            {
                releaseName: 1,
                modules: 1,
            }
        )
        let jobs
        if (!job) {
            return res.status(404).send({ message: 'Job not found' })
        } else {
            let response = []
            let modulesdata = []
            let counts = []
            let rTestNodes = []
            for (let i = 0; i < job?.testRun?.length; i++) {
                let releasetestnodes = release?.modules?.find(
                    (module) => module.moduleID === job?.testRun[0]?.moduleID
                )?.testNodes

                const modules = await Module.find(
                    { _id: job?.testRun[0]?.moduleID },
                    { _id: 1, suiteName: 1, testNodes: 1, testPlaceholders: 1 }
                )

                jobs = [job]

                if (!releasetestnodes) {
                    const module = modules[0]
                    const testNodes = module.testNodes
                    releasetestnodes = testNodes?.map((tNode) => tNode._id)
                }

                let testNodes = []

                for (let mt = 0; mt < modules[0].testNodes.length; mt++) {
                    for (let rtn = 0; rtn < releasetestnodes?.length; rtn++) {
                        if (
                            releasetestnodes[rtn]?.toString() ===
                            modules[0].testNodes[mt]?._id.toString()
                        ) {
                            let formattedDuration = ''
                            if (
                                jobs[0]?.testRun[0]?.testNodes[rtn]
                                    ?.executionDuration
                            ) {
                                const exeduration = new Date(
                                    jobs[0].testRun[0].testNodes[
                                        rtn
                                    ].executionDuration
                                )
                                formattedDuration =
                                    parseInt(exeduration.getMinutes(), 10) !== 0
                                        ? moment(exeduration).format(
                                              'm[m] s[s]'
                                          )
                                        : moment(exeduration).format('s[s]')
                            }

                            testNodes.push({
                                _id: modules[0].testNodes[mt]._id,
                                id: `${modules[0].testNodes[mt]._id}`,
                                moduleId: modules[0]._id,
                                suiteName: modules[0].suiteName,
                                testCaseTitle:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseTitle,
                                testCaseDescription:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseDescription,
                                testCaseID:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseID,
                                tags: modules[0].testNodes[mt].testNode[0].tags,
                                automationStatus:
                                    modules[0].testNodes[mt].testNode[0]
                                        .automationStatus,

                                status:
                                    jobs.length > 0
                                        ? jobs[0].testRun[0].testNodes[rtn]
                                              ?.status
                                        : JobStatus.UNTESTED,
                                executionStart:
                                    jobs.length > 0
                                        ? jobs[0].testRun[0].testNodes[rtn]
                                              ?.executionStart
                                        : '',
                                executionEnd:
                                    jobs.length > 0
                                        ? jobs[0].testRun[0].testNodes[rtn]
                                              ?.executionEnd
                                        : '',
                                executionDuration: formattedDuration,
                            })
                        }
                    }
                }
                let statusCounts
                let formattedDuration = ''
                jobs?.forEach((job) => {
                    statusCounts = responseTransformer.getStatusCounts(
                        job?.testRun
                    )
                    // counts.push(statusCounts)
                })
                if (jobs[0].testRun[0].executionDuration) {
                    // jobs?.forEach((job) => {
                    //     statusCounts = responseTransformer.getStatusCounts(
                    //         job?.testRun
                    //     )
                    //     // counts.push(statusCounts)
                    // })
                    const exeduration = new Date(
                        jobs[0].testRun[0].executionDuration
                    )
                    formattedDuration =
                        parseInt(exeduration.getMinutes(), 10) !== 0
                            ? moment(exeduration).format('m[m] s[s]')
                            : moment(exeduration).format('s[s]')
                }
                // else {
                //     statusCounts = {
                //         total: testNodes?.length,
                //         untested: testNodes?.length,
                //         passed: 0,
                //         skipped: 0,
                //         failed: 0,
                //         percentage: 0,
                //     }
                // }

                counts.push(statusCounts)

                modulesdata.push({
                    _id: modules[0]._id,
                    suiteName: modules[0].suiteName,
                    testNodes: testNodes,
                    testPlaceholders: modules[0].testPlaceholders,
                    executionStart:
                        jobs.length > 0
                            ? jobs[0].testRun[0].executionStart
                            : '',
                    executionEnd:
                        modules.length > 0
                            ? jobs[0].testRun[0].executionEnd
                            : '',
                    executionDuration: formattedDuration,
                    graphTestCases: {
                        total: statusCounts
                            ? statusCounts?.total
                            : testNodes?.length,
                        untested: statusCounts
                            ? statusCounts?.untested
                            : testNodes?.length,
                        passed: statusCounts ? statusCounts?.passed : 0,
                        skipped: statusCounts ? statusCounts?.skipped : 0,
                        failed: statusCounts ? statusCounts?.failed : 0,
                        ignored: statusCounts ? statusCounts?.ignored : 0,
                        warning: statusCounts ? statusCounts?.warning : 0,
                        blocked: 0,
                        percentage: statusCounts ? statusCounts?.percentage : 0,
                    },
                })
                rTestNodes = [...rTestNodes, ...testNodes]
            }
            const rCounts = responseTransformer.getReleaseStatusCounts(counts)
            let executionDuration = ''
            if (jobs[0]?.testRun[0]?.executionDuration) {
                const exeduration = new Date(
                    jobs[0].testRun[0].executionDuration
                )
                executionDuration =
                    parseInt(exeduration.getMinutes(), 10) !== 0
                        ? moment(exeduration).format('m[m] s[s]')
                        : moment(exeduration).format('s[s]')
            }
            const releaseModuleData = {
                _id: jobId,
                testNodes: rTestNodes,
                graphTestCases: {
                    total: rCounts?.total,
                    untested: rCounts?.untested,
                    passed: rCounts?.passed,
                    skipped: rCounts?.skipped,
                    failed: rCounts?.failed,
                    ignored: rCounts?.ignored,
                    warning: rCounts?.warning,
                    blocked: 0,
                    percentage: rCounts?.percentage,
                },
                executionDuration,
            }
            modulesdata.push(releaseModuleData)

            response = {
                _id: jobId,
                releaseName: release?.releaseName,
                suiteName: 'All Modules',
                modules: modulesdata,
            }
            res.status(200).send({ message: 'Data Avaiable', data: response })
        }
    } catch (error) {
        console.error(error)
        res.status(500).send({
            message: 'An error occurred while fetching data',
        })
    }
})

router.get('/v3/getTestRunStatus/:jobId', async (req, res) => {
    const jobId = req.params.jobId
    try {
        const result = await getTestRunStatus(jobId)
        res.send(result)
    } catch (error) {
        console.error(error)
        res.status(500).send({
            message: 'An error occurred while fetching data',
        })
    }
})

const getTestRunStatus = async (jobId) => {
    try {
        const job = await Job.findOne(
            { _id: jobId },
            {
                _id: 1,
                testRun: 1,
                version: 1,
                runningStatus: 1,
                releaseID: 1,
                exportedFilePath: 1,
                jenkinsJobID: 1,
                projectID: 1,
                adoTestRunId: 1,
            }
        )
        const release = await Release.findOne(
            { _id: job?.releaseID },
            {
                releaseName: 1,
                modules: 1,
                _id: 1,
            }
        )
        let jobs
        if (!job) {
            return res.status(404).send({ message: 'Job not found' })
        } else {
            let response = []
            let modulesdata = []
            let counts = []
            let rTestNodes = []
            for (let i = 0; i < job?.testRun?.length; i++) {
                let releasetestnodes = release?.modules?.find(
                    (module) => module.moduleID === job?.testRun[0]?.moduleID
                )?.testNodes

                let modules = await Module.find(
                    { _id: job?.testRun[0]?.moduleID },
                    {
                        _id: 1,
                        suiteName: 1,
                        testNodes: 1,
                        testPlaceholders: 1,
                        projectID: 1,
                    }
                )

                const moduleTags = [
                    ...new Set(
                        modules[0]?.testNodes
                            ?.map((m) => m.testNode[0].tags)
                            .flat()
                    ),
                ]

                modules = await responseTransformer.getModulesDataWithSteps(
                    modules,
                    modules[0]?.projectID,
                    null,
                    jobId
                )

                jobs = [job]

                let jobTags = jobs[0]?.testRun[0]?.tags

                if (jobTags?.length === 0) jobTags = moduleTags

                if (!releasetestnodes || (jobTags && jobTags.length !== 0)) {
                    const module = modules[0]
                    const testNodes = module.testNodes

                    if (jobTags) {
                        releasetestnodes = testNodes?.map((tNode) => {
                            if (
                                tNode._id &&
                                hasCommonElements(
                                    tNode.testNode[0].tags,
                                    jobTags
                                )
                            )
                                return tNode._id
                        })
                        releasetestnodes = releasetestnodes.filter((n) => n)
                    } else {
                        releasetestnodes = testNodes?.map((tNode) => tNode._id)
                    }
                }

                let testNodes = []

                for (let mt = 0; mt < modules[0].testNodes.length; mt++) {
                    for (let rtn = 0; rtn < releasetestnodes?.length; rtn++) {
                        if (
                            releasetestnodes[rtn]?.toString() ===
                            modules[0].testNodes[mt]?._id.toString()
                        ) {
                            let formattedDuration = ''
                            if (
                                jobs[0]?.testRun[0]?.testNodes[rtn]
                                    ?.executionDuration
                            ) {
                                const exeduration = new Date(
                                    jobs[0].testRun[0].testNodes[
                                        rtn
                                    ].executionDuration
                                )
                                formattedDuration =
                                    parseInt(exeduration.getMinutes(), 10) !== 0
                                        ? moment(exeduration).format(
                                              'm[m] s[s]'
                                          )
                                        : moment(exeduration).format('s[s]')
                            }
                            let testStepStatuses = []
                            if (jobs.length !== 0) {
                                testStepStatuses =
                                    jobs[0].testRun[0].testNodes[rtn]
                                        ?.testCaseSteps
                            } else {
                                testStepStatuses =
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseSteps
                            }
                            const id = modules[0].testNodes[mt]._id
                            testNodes.push({
                                _id: modules[0].testNodes[mt]._id,
                                id: `${modules[0].testNodes[mt]._id}`,
                                moduleId: modules[0]._id,
                                suiteName: modules[0].suiteName,
                                testCaseTitle:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseTitle,
                                testCaseDescription:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseDescription,
                                testCaseID:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseID,
                                tags: modules[0].testNodes[mt].testNode[0].tags,
                                automationStatus:
                                    modules[0].testNodes[mt].testNode[0]
                                        .automationStatus,
                                testCaseSteps:
                                    modules[0].testNodes[mt].testNode[0]
                                        .testCaseSteps,
                                testStepStatuses,
                                status:
                                    jobs.length > 0
                                        ? jobs[0].testRun[0].testNodes[rtn]
                                              ?.status
                                        : JobStatus.UNTESTED,
                                executionStart:
                                    jobs.length > 0
                                        ? jobs[0].testRun[0].testNodes[rtn]
                                              ?.executionStart
                                        : '',
                                executionEnd:
                                    jobs.length > 0
                                        ? jobs[0].testRun[0].testNodes[rtn]
                                              ?.executionEnd
                                        : '',
                                executionDuration: formattedDuration,
                            })
                        }
                    }
                }
                let statusCounts
                let formattedDuration = ''
                jobs?.forEach((job) => {
                    statusCounts = responseTransformer.getStatusCounts(
                        job?.testRun
                    )
                    // counts.push(statusCounts)
                })
                if (jobs[0].testRun[0].executionDuration) {
                    // jobs?.forEach((job) => {
                    //     statusCounts = responseTransformer.getStatusCounts(
                    //         job?.testRun
                    //     )
                    //     // counts.push(statusCounts)
                    // })
                    const exeduration = new Date(
                        jobs[0].testRun[0].executionDuration
                    )
                    formattedDuration =
                        parseInt(exeduration.getMinutes(), 10) !== 0
                            ? moment(exeduration).format('m[m] s[s]')
                            : moment(exeduration).format('s[s]')
                }
                // else {
                //     statusCounts = {
                //         total: testNodes?.length,
                //         untested: testNodes?.length,
                //         passed: 0,
                //         skipped: 0,
                //         failed: 0,
                //         percentage: 0,
                //     }
                // }

                counts.push(statusCounts)

                modulesdata.push({
                    _id: modules[0]._id,
                    suiteName: modules[0].suiteName,
                    testNodes: testNodes,
                    testPlaceholders: modules[0].testPlaceholders,
                    executionStart:
                        jobs.length > 0
                            ? jobs[0].testRun[0].executionStart
                            : '',
                    executionEnd:
                        modules.length > 0
                            ? jobs[0].testRun[0].executionEnd
                            : '',
                    executionDuration: formattedDuration,
                    graphTestCases: {
                        total: statusCounts
                            ? statusCounts?.total
                            : testNodes?.length,
                        untested: statusCounts
                            ? statusCounts?.untested
                            : testNodes?.length,
                        passed: statusCounts ? statusCounts?.passed : 0,
                        skipped: statusCounts ? statusCounts?.skipped : 0,
                        failed: statusCounts ? statusCounts?.failed : 0,
                        ignored: statusCounts ? statusCounts?.ignored : 0,
                        warning: statusCounts ? statusCounts?.warning : 0,
                        blocked: 0,
                        percentage: statusCounts ? statusCounts?.percentage : 0,
                    },
                })
                rTestNodes = [...rTestNodes, ...testNodes]
            }
            const rCounts = responseTransformer.getReleaseStatusCounts(counts)
            let executionDuration = ''
            if (jobs[0]?.testRun[0]?.executionDuration) {
                executionDuration = moment(
                    new Date(
                        parseInt(jobs[0]?.testRun[0]?.executionDuration, 10)
                    )
                ).format('m[m] s[s]')
                // executionDuration =
                //     parseInt(exeduration.getMinutes(), 10) !== 0
                //         ? moment(exeduration).format('m[m] s[s]')
                //         : moment(exeduration).format('s[s]')
            }
            const releaseModuleData = {
                _id: jobId,
                testNodes: rTestNodes,
                graphTestCases: {
                    total: rCounts?.total,
                    untested: rCounts?.untested,
                    passed: rCounts?.passed,
                    skipped: rCounts?.skipped,
                    failed: rCounts?.failed,
                    ignored: rCounts?.ignored,
                    warning: rCounts?.warning,
                    blocked: 0,
                    percentage: rCounts?.percentage,
                },
                executionDuration,
            }
            modulesdata.push(releaseModuleData)

            const moduleName = modulesdata[0]?.suiteName

            response = {
                _id: jobId,
                testRun: `${moduleName}_${job.jenkinsJobID}`,
                releaseName: release?.releaseName,
                releaseId: release?._id,
                suiteName: 'All Modules',
                modules: modulesdata,
                runningStatus: job.runningStatus,
                exportedFilePath: job?.exportedFilePath,
            }
            // Ado test run results update
            if (ADO_ENABLED) {
                ;(async () => {
                    try {
                        let project = await common.getProjectNameById(
                            job.projectID
                        )

                        let adoRequestBody = {
                            projectName: project.name,
                            testRunId: job.adoTestRunId,
                            testCasesResults: formatAdoTestResultsRequestBody(
                                modulesdata[0].testNodes
                            ),
                        }
                        // console.log('7050', adoRequestBody)
                        const headers = {
                            'Content-Type': 'application/json',
                        }
                        const adoJobUpdate = await axios.patch(
                            `${process.env.ADO_INTEGRATION_HOST}/api/test-results/updateAdoTestResultForTestRunById`,
                            adoRequestBody,
                            { headers }
                        )

                        // Attach screenshot to ado test case
                        let testResultFiles = extractTestResultAttachments(
                            modulesdata[0].testNodes
                        )
                        // console.log('7063', testResultFiles)
                        for (let testResultFile of testResultFiles) {
                            let base64String
                            // testResultFile.stream =
                            // let base64String =
                            //     'data:image/png;base64,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'
                            // testResultFile.stream = base64String.replace(
                            //     /^data:image\/\w+;base64,/,
                            //     ''
                            // )
                            try {
                                // Need to read files and send base64 strings
                                if (process.env.AWS_S3_BUCKET) {
                                    const screenshotParams = {
                                        Bucket: process.env.AWS_S3_BUCKET,
                                        Key: testResultFile.fileNameToRead,
                                    }
                                    base64String =
                                        await getObjectFromS3(screenshotParams) // Assuming this returns string
                                } else if (sharedStorage) {
                                    logger.info(
                                        `screenshotParams : ${testStep?.testStepResultsFile}`
                                    )
                                    const remoteFilePath = path.join(
                                        testResultFile.fileNameToRead
                                    )
                                    base64String =
                                        await responseTransformer.readFileFromSMBPath(
                                            null,
                                            remoteFilePath
                                        )
                                } else if (mountStorage) {
                                    const remoteFilePath = path.join(
                                        testResultFile.fileNameToRead
                                    )

                                    base64String =
                                        await getScreenshotFromMountLocation(
                                            remoteFilePath
                                        )
                                }
                                testResultFile.stream = base64String.replace(
                                    /^data:image\/\w+;base64,/,
                                    ''
                                )
                            } catch (err) {
                                console.log('Error during file reading', err)
                            }
                        }

                        adoRequestBody = {
                            projectName: project.name,
                            testRunId: job.adoTestRunId,
                            testCasesResultAttachments: testResultFiles,
                        }

                        // console.log('7109', adoRequestBody)

                        let response = await axios.post(
                            `${process.env.ADO_INTEGRATION_HOST}/api/test-results/attachScreenshotToTestResult`,
                            adoRequestBody,
                            { headers }
                        )
                        // console.log('7116', response)
                    } catch (err) {
                        logger.error(
                            `Error during ADO Test result call: ${err}`
                        )
                    }
                })()
            }
            return { status: 200, message: 'Data Avaiable', data: response }
        }
    } catch (error) {
        console.error(error)
        return {
            status: 500,
            message: 'An error occurred while fetching data',
        }
    }
}

function formatAdoTestResultsRequestBody(testNodes) {
    const baseId = 100000
    let adoState
    const statusMap = {
        UNTESTED: 'NotExecuted',
        PASSED: 'Passed',
        FAILED: 'Failed',
        WARNING: 'Warning',
    }

    console.log('Total Test Cases:', testNodes.length)

    return testNodes.map((testCase, caseIndex) => {
        const testResultId = baseId + caseIndex
        const steps = testCase.testStepStatuses

        console.log(
            `\n===== TEST CASE ${caseIndex + 1}: ${testCase.testCaseTitle || ''} =====`
        )
        console.log(`Total steps in TE: ${steps.length}`)

        steps.forEach((step, stepIndex) => {
            console.log(`Step ${stepIndex + 1}:`, {
                stepIndex,
                status: step.status,
                mappedStatus: statusMap[step.status] || 'NotExecuted',
                errorMessage: step.errorMessage || '',
                durationInMs: step.durationInMs || 0,
            })
        })
        // Map all steps
        console.log(`====================================\n`)
        // Need to start from 2 only as hexadecimal denotion starts from 2
        // And also test step id in get test cases ADO API also begins with 2
        const START_INDEX = 2
        const actionResults = steps.map((step, stepIndex) => {
            const adoStepId = START_INDEX + stepIndex // 2,3,4...

            return {
                // The below sends the number in hexadecimal format
                // which is required for Azure dev ops test case step mapping
                // What is actionPath?
                // When Azure DevOps stores test steps, it doesn't store step number like 1,2,3....
                // It uses a hidden internal ID per step called actionPath.

                // This value:
                // Is Hexadecimal (base-16);Always 8 digits
                // First step ID starts from 2 (not 1)
                actionPath: adoStepId
                    .toString(16)
                    .toUpperCase()
                    .padStart(8, '0'),
                iterationId: 1,
                outcome: statusMap[step.status] || 'NotExecuted',
                errorMessage: step.errorMessage || '',
                durationInMs: step.durationInMs || 0,
            }
        })
        console.log(`Steps pushed to ADO: ${actionResults.length}`)

        // Setting ADO test case status on the basis of TE test case status
        adoState = testCase.status === 'UNTESTED' ? 'InProgress' : 'Completed'

        return {
            id: testResultId,
            state: adoState,
            outcome: statusMap[testCase.status] || 'NotExecuted',
            comment: testCase.comment || '',
            iterationDetails: [
                {
                    id: 1,
                    actionResults,
                },
            ],
        }
    })
}

// Only fetching last test case step screenshot against each test case.
// Only for demo purpose

function extractTestResultAttachments(testNodes) {
    const baseId = 100000
    const results = []

    for (let caseIndex = 0; caseIndex < testNodes.length; caseIndex++) {
        const testCase = testNodes[caseIndex]
        const testResultId = baseId + caseIndex
        let fileNameToRead = null
        let fileName = null
        // Loop steps and pick first screenshot file
        for (const step of testCase.testStepStatuses || []) {
            if (
                step.testStepResultsFile &&
                typeof step.testStepResultsFile === 'string'
            ) {
                fileNameToRead = step.testStepResultsFile // take string directly
                // ADO does not accepts special characters in file name; So sending step id as file name
                fileName = `step_${step._id}.png`
                // break; // ✅ stop at first screenshot
            }
        }
        if (fileNameToRead)
            results.push({
                testResultId,
                fileNameToRead, // null if no screenshot found
                fileName,
            })
    }

    return results
}

router.get('/getMultipleTestRunStatus/:ids', async (req, res) => {
    let jobIds = req.params.ids.split(',')
    const promises = jobIds.map((id) => getTestRunStatus(id))
    try {
        const results = await Promise.all(promises)
        res.send(results)
    } catch (error) {
        console.error(error)
        res.status(500).send({
            message: 'An error occurred while fetching data',
        })
    }
})

router.post('/v1/exportModule', async (req, res) => {
    let body = req.body
    let projectid = body.ProjectId
    const modules = await Module.find(
        {
            projectID: projectid,
        },
        {
            _id: 1,
            version: 1,
            suiteName: 1,
        },
        {
            sort: { createdAt: -1 },
        }
    )
    const uniqueSuites = new Set()
    const result = []

    for (const item of modules) {
        if (!uniqueSuites.has(item.suiteName)) {
            uniqueSuites.add(item.suiteName)
            result.push(item)
        }
    }
    let ModuleIds = []
    for (let i = 0; i < result.length; i++) {
        ModuleIds.push(result[i]._id)
    }
    if (ModuleIds.length < 1) {
        res.send({ status: 204, Message: 'Module ID Required', data: [] })
    } else {
        let respdata = []
        for (let m = 0; m < ModuleIds.length; m++) {
            let modulesdata = await Module.find(
                { _id: ModuleIds[m] },
                { _id: 1, suiteName: 1, testNodes: 1 }
            )

            modulesdata = await responseTransformer.getModulesDataWithSteps(
                modulesdata,
                projectid,
                null,
                null
            )
            let exceldata = []
            for (let x = 0; x < modulesdata.length; x++) {
                for (let y = 0; y < modulesdata[x].testNodes.length; y++) {
                    let steps =
                        modulesdata[x].testNodes[y].testNode[0].testCaseSteps
                    steps = steps.filter(
                        (step) =>
                            !Object.keys(step).some((key) =>
                                ExcludeKeys.includes(key)
                            )
                    )
                    let stepno = 1
                    for (let z = 0; z < steps.length; z++) {
                        let tstr = JSON.stringify(steps[z])

                        const subArr = ExcludeKeys.filter((str) =>
                            tstr.includes(str)
                        )
                        if (subArr.length == 0) {
                            const newMsg = {}
                            let tsd = responseTransformer.findVal(
                                JSON.parse(tstr),
                                KEYS.TESTSTEPDESCRIPTION
                            )
                            if (z == 0) {
                                if (tsd === 'undefined' || tsd == undefined) {
                                } else {
                                    newMsg.testCaseID =
                                        modulesdata[x].testNodes[
                                            y
                                        ].testNode[0].testCaseID
                                    newMsg.testCaseTitle =
                                        modulesdata[x].testNodes[
                                            y
                                        ].testNode[0].testCaseTitle
                                    newMsg.testCaseDescription =
                                        modulesdata[x].testNodes[
                                            y
                                        ].testNode[0].testCaseDescription
                                    newMsg.StepNo = stepno
                                    newMsg.Expected = tsd
                                    newMsg.testStepDescription = tsd
                                }
                            } else {
                                if (tsd === 'undefined' || tsd == undefined) {
                                } else {
                                    newMsg.testCaseID = ''
                                    newMsg.testCaseTitle = ''
                                    newMsg.testCaseDescription = ''
                                    newMsg.StepNo = stepno
                                    newMsg.Expected = tsd
                                    newMsg.testStepDescription = tsd
                                }
                            }
                            exceldata.push(newMsg)
                            stepno++
                        }
                    }
                }
            }

            respdata.push({ sname: modulesdata[0].suiteName, edata: exceldata })
        }

        response = {
            exceldata: respdata,
        }
        res.status(200).send({ message: 'Data Avaiable', data: response })
    }
})

router.post('/v1/tagTestCases', async (req, res) => {
    let body = req.body
    let respdata = []

    const modulesdata = await Module.find(
        { projectID: body.ProjectId },
        { _id: 1, suiteName: 1, testNodes: 1, version: 1 },
        { sort: { createdAt: -1 } }
    )
    let tagMap = new Map()
    let x = 0
    // for (let x = 0; x < modulesdata.length; x++) {
    for (let y = 0; y < modulesdata[x].testNodes.length; y++) {
        let tagsdt = modulesdata[x].testNodes[y].testNode[0].tags
        let testCaseID = modulesdata[x].testNodes[y].testNode[0].testCaseID
        let testCaseTitle =
            modulesdata[x].testNodes[y].testNode[0].testCaseTitle
        let testCaseDescription =
            modulesdata[x].testNodes[y].testNode[0].testCaseDescription
        let testCaseSteps =
            modulesdata[x].testNodes[y].testNode[0].testCaseSteps

        for (let t = 0; t < tagsdt.length; t++) {
            if (!tagMap.has(tagsdt[t])) {
                tagMap.set(tagsdt[t], new Map())
            }
            if (!tagMap.get(tagsdt[t]).has(testCaseID)) {
                tagMap.get(tagsdt[t]).set(testCaseID, {
                    testCaseID,
                    testCaseTitle,
                    testCaseDescription,
                    testCaseSteps,
                })
            }
        }
    }
    // }
    let tags = Array.from(tagMap, ([tagname, testCaseMap]) => ({
        tagname,
        testCase: Array.from(testCaseMap.values()),
    }))

    let excdt = []
    for (let i = 0; i < tags.length; i++) {
        for (let j = 0; j < tags[i].testCase.length; j++) {
            if (j == 0) {
                excdt.push({
                    tagname: tags[i].tagname,
                    testCaseID: tags[i].testCase[j].testCaseID,
                    testCaseTitle: tags[i].testCase[j].testCaseTitle,
                    testCaseDescription:
                        tags[i].testCase[j].testCaseDescription,
                })
            } else {
                excdt.push({
                    tagname: '',
                    testCaseID: tags[i].testCase[j].testCaseID,
                    testCaseTitle: tags[i].testCase[j].testCaseTitle,
                    testCaseDescription:
                        tags[i].testCase[j].testCaseDescription,
                })
            }
            exceldata.push(newMsg)
        }
    }

    respdata.push({ tags: tags })

    response = {
        exceldata: respdata,
    }
    res.status(200).send({ message: 'Data Avaiable', data: response })
})
router.post('/v1/deleteFiles', async (req, res) => {
    let jobArray = []
    let jobsDeleted = []
    const jobsdata = await Job.find({}, { _id: 1 })
    if (jobsdata.length > 0) {
        console.log(jobsdata)
        jobArray = jobsdata.map((job) => job.id)
    }

    const bucketName = process.env.AWS_S3_BUCKET
    const folderNames = ['jobs', 'videos']

    folderNames.forEach((folderName) => {
        console.log(`Deleting objects from folder: ${folderName}`)
        async function deleteFolder(bucketName, folderName) {
            try {
                let continuationToken
                let objectsToDelete = []

                do {
                    objectsToDelete = []
                    const listParams = {
                        Bucket: bucketName,
                        Prefix: folderName,
                        ContinuationToken: continuationToken,
                    }

                    const listResponse = await s3.send(
                        new ListObjectsV2Command(listParams)
                    )
                    continuationToken = listResponse.NextContinuationToken

                    if (listResponse.Contents) {
                        for (const obj of listResponse.Contents) {
                            const subArr = !jobArray.includes(
                                obj.Key.split('/')[1]
                            )
                            if (subArr) {
                                jobsDeleted.push(obj.Key.split('/')[1])
                                objectsToDelete.push({ Key: obj.Key })
                            }
                        }
                        console.log('jobs Deleted', jobsDeleted.length)
                        console.log('objectsToDelete ', objectsToDelete.length)
                        const deleteParams = {
                            Bucket: bucketName,
                            Delete: {
                                Objects: objectsToDelete,
                            },
                        }

                        if (objectsToDelete.length > 0) {
                            await s3.send(
                                new DeleteObjectsCommand(deleteParams)
                            )
                            console.log(
                                `Deleted all objects in folder ${folderName}`
                            )
                        }
                    }
                } while (continuationToken)

                jobsDeleted = [...new Set(jobsDeleted)]

                if (objectsToDelete.length > 0) {
                    const deleteParams = {
                        Bucket: bucketName,
                        Delete: {
                            Objects: objectsToDelete,
                        },
                    }

                    // await s3.send(new DeleteObjectsCommand(deleteParams))
                    console.log(`Deleted all objects in folder ${folderName}`)
                } else {
                    console.log(`No objects found in folder ${folderName}`)
                }
            } catch (err) {
                console.error('Error deleting objects:', err)
            }
        }

        deleteFolder(bucketName, folderName)
    })

    res.status(200).send({ message: 'Data Avaiable', data: jobsDeleted })
})

router.get('/v1/getmodulestatus/:releaseId', async (req, res) => {
    const releaseId = req.params.releaseId // Assume releaseId is passed as a query parameter
    try {
        // Step 1: Find releases by ID
        const release = await Release.findOne(
            { _id: releaseId },
            { releaseName: 1, modules: 1 }
        )
        if (!release) {
            return res.status(404).send({ message: 'Release not found' })
        } else {
            let respobj = []
            for (let i = 0; i < release.modules.length; i++) {
                let modulesdata = []
                respobj.push({ releaseName: release.releaseName })

                const modules = await Module.find(
                    { _id: release.modules[i].moduleID },
                    { _id: 1, suiteName: 1, testNodes: 1 }
                )
                modulesdata.push({
                    mid: release.modules[i].moduleID,
                })

                let query = {
                    releaseID: releaseId,
                    'testRun.moduleID': release.modules[i].moduleID,
                }
                const jobs = await Job.find(query, {
                    _id: 1,
                    testRun: 1,
                    version: 1,
                    runningStatus: 1,
                }).sort({ createdAt: -1 })
                let testnodes = []
                for (let k = 0; k < jobs[0].testRun[0].testNodes.length; k++) {
                    testnodes.push({
                        status: jobs[0].testRun[0].testNodes[k].status,
                        executionStart:
                            jobs[0].testRun[0].testNodes[k].executionStart,
                        executionEnd:
                            jobs[0].testRun[0].testNodes[k].executionEnd,
                        executionDuration:
                            jobs[0].testRun[0].testNodes[k].executionDuration,
                        testCaseSteps:
                            jobs[0].testRun[0].testNodes[k].testCaseSteps,
                    })
                }
                respobj.push({
                    moduleId: modules[0]._id,
                    suiteName: modules[0].suiteName,
                    runningStatus: jobs[0].runningStatus,
                    jobversion: jobs[0].version,
                    testRunStatus: jobs[0].testRun[0].status,
                    executionStart: jobs[0].testRun[0].executionStart,
                    executionEnd: jobs[0].testRun[0].executionEnd,
                    executionDuration: jobs[0].testRun[0].executionDuration,
                    testNode: testnodes,
                })
            }
            res.status(200).send({ message: 'Data Avaiable', data: respobj })
        }
    } catch (error) {
        console.error(error)
        res.status(500).send({
            message: 'An error occurred while fetching data',
        })
    }
})
// TestResult creation
router.post('/reRunJob/:jobID', async (req, res) => {
    const warnings = []
    try {
        Job.findById(req.params.jobID, async (err, job) => {
            const { testRun } = job
            const newTestRuns = []
            const release = await Release.findById(job?.releaseID)
            testRun?.forEach((module) => {
                const newTestRun = {}

                const { testNodes } = module
                const newTestNodes = testNodes?.map((testNode) => {
                    const newTestNode = {}
                    newTestNode.testNodeID = testNode?.testNodeID
                    newTestNode.status = JobStatus.UNTESTED
                    const newTestSteps = testNode?.testCaseSteps?.map(
                        (testStep) => {
                            const newTestStep = {}
                            newTestStep._id = testStep?._id
                            newTestStep.status = JobStatus.UNTESTED
                            return newTestStep
                        }
                    )
                    newTestNode.testCaseSteps = newTestSteps
                    return newTestNode
                })
                newTestRun.moduleID = module?.moduleID
                newTestRun.testNodes = newTestNodes
                newTestRun.status = JobStatus.UNTESTED
                newTestRuns.push(newTestRun)
            })

            await Job.findByIdAndUpdate(job?._id, {
                runningStatus: 'Re Run',
                testRun: newTestRuns,
            })
            await Job.updateOne(
                { _id: job?._id },
                {
                    $unset: {
                        executionStart: 1,
                        executionDuration: 1,
                        executionEnd: 1,
                    },
                }
            )
            responseTransformer.passthroughError(
                err,
                job,
                'finding release',
                res,
                async (job) => {
                    const release = await Release.findById(job.releaseID)

                    const templateID = release.templateID

                    logger.info('Getting crumb data')
                    if (templateID) {
                        const template = await Template.findById(templateID)
                        if (template) {
                            jenkinsConfig.parentProject = getJobName(
                                template.name
                            )
                            jenkinsConfig.endpoint = template.endpoint
                            jenkinsConfig.headers.Authorization = `Basic ${Buffer.from(
                                `${template.username}:${template.password}`
                            ).toString('base64')}`
                        }
                    }
                    axios
                        .get(jenkinsConfig.getCrumb(), {
                            headers: {
                                Authorization:
                                    jenkinsConfig.headers.Authorization,
                            },
                        })
                        .then((data) => {
                            jenkinsConfig.headers['Jenkins-Crumb'] =
                                data.data.crumb
                            /** automation case **/
                            try {
                                logger.info('Trying to run the job')
                                /** updating jobId in release test Data Ends **/
                                const jobName = job?.jenkinsJobName
                                responseTransformer.passthroughError(
                                    err,
                                    job,
                                    'creating job',
                                    res,
                                    (job) => {
                                        logger.info('Trying to create a job')
                                        axios
                                            .post(
                                                jenkinsConfig.createItem(
                                                    jobName
                                                ),
                                                {},
                                                {
                                                    headers:
                                                        jenkinsConfig.headers,
                                                }
                                            )
                                            .catch((cjerr) =>
                                                logger.error(
                                                    'Issue while posting to jenkins',
                                                    {
                                                        stack: cjerr.stack,
                                                    }
                                                )
                                            )
                                            .finally(() => {
                                                logger.info(
                                                    'Trying to disable the job'
                                                )
                                                axios
                                                    .post(
                                                        jenkinsConfig.disableJob(
                                                            jobName
                                                        ),
                                                        {},
                                                        {
                                                            headers:
                                                                jenkinsConfig.headers,
                                                        }
                                                    )
                                                    .catch((djerr) =>
                                                        logger.error(
                                                            'Issue while disabling the job',
                                                            {
                                                                stack: djerr.stack,
                                                            }
                                                        )
                                                    )
                                                    .finally(() => {
                                                        logger.info(
                                                            'Trying to enable the job'
                                                        )
                                                        axios
                                                            .post(
                                                                jenkinsConfig.enableJob(
                                                                    jobName
                                                                ),
                                                                {},
                                                                {
                                                                    headers:
                                                                        jenkinsConfig.headers,
                                                                }
                                                            )
                                                            .catch((ejerr) =>
                                                                logger.error(
                                                                    'Issue while enabling the job',
                                                                    {
                                                                        stack: ejerr.stack,
                                                                    }
                                                                )
                                                            )
                                                            .finally(() => {
                                                                axios
                                                                    .post(
                                                                        jenkinsConfig.runJob(
                                                                            jobName,
                                                                            job._id
                                                                        ),
                                                                        {},
                                                                        {
                                                                            headers:
                                                                                jenkinsConfig.headers,
                                                                        }
                                                                    )
                                                                    .then(
                                                                        async (
                                                                            rjdata
                                                                        ) => {
                                                                            logger.info(
                                                                                `Run job success, ${JSON.stringify(
                                                                                    rjdata,
                                                                                    responseTransformer.getCircularReplacer()
                                                                                )}`
                                                                            )
                                                                        }
                                                                    )
                                                                    .catch(
                                                                        (
                                                                            rjerr
                                                                        ) => {
                                                                            logger.error(
                                                                                'Run job error',
                                                                                {
                                                                                    stack: rjerr.stack,
                                                                                }
                                                                            )
                                                                            res.status(
                                                                                400
                                                                            ).json(
                                                                                rjerr.data
                                                                            )
                                                                        }
                                                                    )
                                                            })
                                                    })
                                            })
                                    }
                                )
                                //testPlaceholders for loop
                                /**update tps with job Ids starts*/
                            } catch (error) {
                                warnings.push(
                                    `error occurred in createjob ${error}`
                                )
                            }
                            /**update tps with job Ids ends*/
                        }) //releaseModules for loop
                }
            )
            // })
        })
    } catch (error) {
        logger.warn(`Encountered warnings while serving request: ${warnings}`)
        res.send({ status: 400, message: 'Bad Request', data: error, warnings })
    }
})

// TestResult creation
router.post('/stopJob/:jobID', async (req, res) => {
    const warnings = []
    try {
        Job.findById(req.params.jobID, async (err, job) => {
            const release = await Release.findById(job?.releaseID)

            responseTransformer.passthroughError(
                err,
                job,
                'finding release',
                res,
                async (job) => {
                    const release = await Release.findById(job.releaseID)
                    const templateID = release?.templateID
                    logger.info('Getting crumb data')
                    if (templateID) {
                        const template = await Template.findById(templateID)
                        if (template) {
                            jenkinsConfig.parentProject = getJobName(
                                template.name
                            )
                            jenkinsConfig.endpoint = template.endpoint
                            jenkinsConfig.headers.Authorization = `Basic ${Buffer.from(
                                `${template.username}:${template.password}`
                            ).toString('base64')}`
                        }
                    }
                    axios
                        .get(jenkinsConfig.getCrumb(), {
                            headers: {
                                Authorization:
                                    jenkinsConfig.headers.Authorization,
                            },
                        })
                        .then((data) => {
                            jenkinsConfig.headers['Jenkins-Crumb'] =
                                data.data.crumb
                            /** automation case **/
                            try {
                                logger.info('Trying to stop the job')
                                /** updating jobId in release test Data Ends **/
                                const jobName = job?.jenkinsJobName
                                const jenkinsJobID = job?.jenkinsJobID
                                const jenkinsBuildNumber =
                                    job?.jenkinsBuildNumber
                                responseTransformer.passthroughError(
                                    err,
                                    job,
                                    'Stopping job',
                                    res,
                                    (job) => {
                                        logger.info('Trying to stop job')
                                        if (
                                            (jenkinsJobID &&
                                                jenkinsJobID != 'TODO') ||
                                            jenkinsBuildNumber
                                        ) {
                                            axios
                                                .post(
                                                    jenkinsBuildNumber
                                                        ? jenkinsConfig.stopJobWithBuildNumber(
                                                              jobName,
                                                              jenkinsBuildNumber
                                                          )
                                                        : jenkinsConfig.stopJobWithBuildId(
                                                              jenkinsJobID
                                                          ),
                                                    {},
                                                    {
                                                        headers:
                                                            jenkinsConfig.headers,
                                                    }
                                                )
                                                .then(async (response) => {
                                                    if (
                                                        job?.lambdatest?.status
                                                    ) {
                                                        await Job.findByIdAndUpdate(
                                                            job?._id,
                                                            {
                                                                runningStatus:
                                                                    'Aborted',
                                                                'lambdatest.status':
                                                                    'View',
                                                            }
                                                        )
                                                    } else {
                                                        await Job.findByIdAndUpdate(
                                                            job?._id,
                                                            {
                                                                runningStatus:
                                                                    'Aborted',
                                                            }
                                                        )
                                                    }
                                                })
                                                .catch((cjerr) =>
                                                    logger.error(
                                                        'Issue while posting to jenkins',
                                                        {
                                                            stack: cjerr.stack,
                                                        }
                                                    )
                                                )
                                                .finally(() => {
                                                    logger.info(
                                                        'Trying to disable the job'
                                                    )
                                                })
                                        }
                                    }
                                )
                                //testPlaceholders for loop
                                /**update tps with job Ids starts*/
                            } catch (error) {
                                warnings.push(
                                    `error occurred in createjob ${error}`
                                )
                            }
                            /**update tps with job Ids ends*/
                        }) //releaseModules for loop
                }
            )
            // })
        })
    } catch (error) {
        logger.warn(`Encountered warnings while serving request: ${warnings}`)
        res.send({ status: 400, message: 'Bad Request', data: error, warnings })
    }
})

// ALL jobs
router.get('/AllJobs', async (req, res) => {
    try {
        if (req.userID) {
            Project.find({ team: { $in: req.userID } }, (err, projects) => {
                responseTransformer.passthroughError(
                    err,
                    projects,
                    'list projects',
                    res,
                    (projects) => {
                        const projectIds = projects.map((p) => p._id)
                        Module.find(
                            { projectID: { $in: projectIds } },
                            (err, modules) => {
                                responseTransformer.passthroughError(
                                    err,
                                    modules,
                                    'list modules',
                                    res,
                                    (modules) => {
                                        const moduleIds = modules.map(
                                            (m) => m._id
                                        )
                                        Release.find(
                                            {
                                                'modules.moduleID': {
                                                    $in: moduleIds,
                                                },
                                            },
                                            (err, releases) => {
                                                responseTransformer.passthroughError(
                                                    err,
                                                    releases,
                                                    'list releases',
                                                    res,
                                                    (releases) => {
                                                        const releaseIds =
                                                            releases.map(
                                                                (r) => r._id
                                                            )
                                                        Job.find(
                                                            {
                                                                releaseID: {
                                                                    $in: releaseIds,
                                                                },
                                                            },
                                                            (err, jobs) => {
                                                                responseTransformer.dbResponseTransformer(
                                                                    err,
                                                                    jobs,
                                                                    'list jobs',
                                                                    res
                                                                )
                                                            }
                                                        )
                                                    }
                                                )
                                            }
                                        )
                                    }
                                )
                            }
                        )
                    }
                )
            })
        } else {
            Job.aggregate([{ $sort: { createdAt: -1 } }], (err, jobs) =>
                responseTransformer.dbResponseTransformer(
                    err,
                    jobs,
                    'list all jobs',
                    res
                )
            )
        }
    } catch (error) {
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

// ALL jobs for a release
router.get('/AllJobs/:releaseID', async (req, res) => {
    const warnings = []
    try {
        Job.aggregate(
            [
                { $match: { releaseID: req.params.releaseID } },
                { $sort: { createdAt: -1 } },
            ],
            (err, jobs) => {
                const newJobs = jobs?.map((job) => {
                    const { testRun } = job
                    const modules = testRun?.map((module) => {
                        const { testNodes } = module
                        const newTestNodes = testNodes?.map((testNode) => {
                            let formattedDuration = ''
                            try {
                                if (testNode.executionDuration) {
                                    const date = new Date(
                                        testNode.executionDuration
                                    )
                                    formattedDuration =
                                        parseInt(date.getMinutes(), 10) !== 0
                                            ? moment(date).format('m[m] s[s]')
                                            : moment(date).format('s[s]')
                                }
                            } catch (error) {
                                warnings.push(error)
                            }
                            return {
                                ...testNode,
                                executionDuration: testNode.executionDuration
                                    ? formattedDuration
                                    : testNode.status === JobStatus
                                      ? '0s'
                                      : null,
                            }
                        })
                        let formattedDuration = ''
                        try {
                            if (module.executionDuration) {
                                const date = new Date(module.executionDuration)
                                formattedDuration =
                                    parseInt(date.getMinutes(), 10) !== 0
                                        ? moment(date).format('m[m] s[s]')
                                        : moment(date).format('s[s]')
                            }
                        } catch (error) {
                            warnings.push(error)
                        }

                        return {
                            ...module,
                            testNodes: newTestNodes,
                            executionDuration: module.executionDuration
                                ? formattedDuration
                                : null,
                        }
                    })

                    let formattedDuration = ''
                    try {
                        if (job.executionDuration) {
                            const date = new Date(
                                parseInt(job.executionDuration, 10)
                            )
                            formattedDuration =
                                parseInt(date.getMinutes(), 10) !== 0
                                    ? moment(date).format('m[m] s[s]')
                                    : moment(date).format('s[s]')
                        }
                    } catch (error) {
                        warnings.push(error)
                    }

                    const newJob = {
                        _id: job._id,
                        jenkinsJobID: job.jenkinsJobID,
                        jenkinsPath: job.jenkinsPath,
                        tpId: job.tpId,
                        releaseID: job.releaseID,
                        createdBy: job.createdBy,
                        createdAt: job.createdAt,
                        reportPortal: job.reportPortal,
                        updatedAt: job.updatedAt,
                        __v: job.__v,
                        executionStart: job.executionStart,
                        testRun: modules,
                        executionDuration: job.executionDuration
                            ? formattedDuration
                            : null,
                        executionEnd: job.executionEnd,
                    }
                    return newJob
                })
                responseTransformer.dbResponseTransformer(
                    err,
                    newJobs,
                    'list all jobs',
                    res
                )
            }
        )
    } catch (error) {
        logger.warn(`Encountered warnings while serving request: ${warnings}`)
        res.send({ status: 400, message: 'Bad Request', data: error, warnings })
    }
})

//Job Details
router.get('/jobDetails/:id', async (req, res) => {
    const warnings = []
    try {
        const job = await Job.findById(req.params.id)
        // (err, job) => {
        if (job) {
            const { testRun } = job
            const modules = testRun?.map((module) => {
                const { testNodes } = module
                const newTestNodes = testNodes?.map((testNode) => {
                    let formattedDuration = ''
                    try {
                        if (testNode.executionDuration) {
                            const date = new Date(testNode.executionDuration)
                            formattedDuration =
                                parseInt(date.getMinutes(), 10) !== 0
                                    ? moment(date).format('m[m] s[s]')
                                    : moment(date).format('s[s]')
                        } else if (testNode?.status !== JobStatus.UNTESTED) {
                            formattedDuration = '0s'
                        }
                    } catch (error) {
                        warnings.push(error)
                    }
                    return {
                        ...testNode,
                        executionDuration: formattedDuration
                            ? formattedDuration
                            : testNode.status === JobStatus.SKIPPED
                              ? '0s'
                              : null,
                    }
                })
                let formattedDuration = ''
                try {
                    if (module.executionDuration) {
                        const date = new Date(module.executionDuration)
                        formattedDuration =
                            parseInt(date.getMinutes(), 10) !== 0
                                ? moment(date).format('m[m] s[s]')
                                : moment(date).format('s[s]')
                    }
                } catch (error) {
                    warnings.push(error)
                }

                return {
                    ...module,
                    testNodes: newTestNodes,
                    executionDuration: module.executionDuration
                        ? formattedDuration
                        : null,
                }
            })

            let formattedDuration = ''
            try {
                if (job.executionDuration) {
                    const date = new Date(parseInt(job.executionDuration, 10))
                    formattedDuration =
                        parseInt(date.getMinutes(), 10) !== 0
                            ? moment(date).format('m[m] s[s]')
                            : moment(date).format('s[s]')
                }
            } catch (error) {
                warnings.push(error)
            }

            const newJob = {
                _id: job._id,
                jenkinsJobID: job.jenkinsJobID,
                jenkinsPath: job.jenkinsPath,
                tpId: job.tpId,
                releaseID: job.releaseID,
                createdBy: job.createdBy,
                createdAt: job.createdAt,
                reportPortal: job.reportPortal,
                updatedAt: job.updatedAt,
                __v: job.__v,
                executionStart: job.executionStart,
                testRun: modules,
                executionDuration: job.executionDuration
                    ? formattedDuration
                    : null,
                executionEnd: job.executionEnd,
            }
            responseTransformer.dbResponseTransformer(
                null,
                newJob,
                'get job',
                res
            )
        } else {
            res.send({ status: 400, message: 'No Job Found !!' })
        }

        // })
    } catch (error) {
        logger.info(`Encountered issue while serving request : ${error}`)
        logger.warn(`Encountered warnings while serving request: ${warnings}`)
        res.send({ status: 400, message: 'Bad Request', data: error, warnings })
    }
})

// Get Updated Release details where its test runs are executing
router.get('/ReleaseDetail/:ids', async (req, res) => {
    let releaseIds = req.params.ids.split(',')
    let releases, jobs, mergedObj
    let singleModuleReleaseIds = [],
        multiModuleReleaseIds = [],
        singleModuleReleases = [],
        multiModuleReleases = [],
        updatedReleases = []
    let startTime, endTime
    const { includeFailedTestCaseStepDetails } = req.query
    let screenshotData
    let logData
    try {
        releases = await Release.find({
            _id: { $in: releaseIds },
        })

        // If a release have multiple modules, it will have multiple jobs or
        // If a release has a single module, it can have multiple testplaceholders (dataproviders)
        // In the above cases, need to fetch the summation of test cases of all the jobs
        for (let release of releases) {
            if (
                release.modules.length === 1 &&
                release.modules[0].testPlaceholders?.length <= 1
            ) {
                singleModuleReleaseIds.push(release._id)
                singleModuleReleases.push(release)
            } else {
                multiModuleReleaseIds.push(release._id)
                multiModuleReleases.push(release)
            }
        }

        if (singleModuleReleaseIds.length > 0) {
            jobs = await Job.aggregate([
                {
                    $match: {
                        $or: singleModuleReleases.map((release) => ({
                            releaseID: String(release._id),
                            version: release.testRunVersion,
                        })),
                    },
                },
            ])

            for (const job of jobs) {
                let total = 0
                let untested = 0
                let passed = 0
                let skipped = 0
                let failed = 0
                let ignored = 0
                let warning = 0
                let percentage = 0
                let formattedDuration
                let release = singleModuleReleases.filter(
                    (release) => job.releaseID == release._id
                )
                if (release) {
                    const testRun = job?.testRun
                    if (includeFailedTestCaseStepDetails == 'true') {
                        if (testRun[0]?.status === 'FAILED') {
                            let result =
                                await readFailedTestCaseStepDetails(job)
                            screenshotData = result?.screenShotData
                            logData = result?.logData
                        }
                    }
                    const statusCounts =
                        responseTransformer.getStatusCounts(testRun)
                    total += statusCounts?.total
                    untested += statusCounts?.untested
                    passed += statusCounts?.passed
                    skipped += statusCounts?.skipped
                    failed += statusCounts?.failed
                    ignored += statusCounts?.ignored
                    warning += statusCounts?.warning
                    percentage = parseInt((passed / total) * 100, 10)
                    startTime = moment(job?.executionStart)
                    endTime = moment(job?.executionEnd)
                    duration = moment.duration(endTime.diff(startTime))
                    minutes = duration.minutes()
                    seconds = Math.floor(duration.seconds())
                    formattedDuration = `${minutes}m ${seconds}s`
                    mergedObj = {
                        _id: release[0]._id,
                        releaseName: release[0].releaseName,
                        description: release[0].description,
                        version: release[0].version,
                        releaseDate: release[0].releaseDate,
                        schedule: release[0].schedule,
                        createdBy: release[0].createdBy,
                        createdAt: release[0].createdAt,
                        updatedAt: release[0].updatedAt,
                        __v: release[0].__v,
                        testRunVersion: release[0].testRunVersion,
                        executionStart: job.executionStart,
                        executionDuration: formattedDuration,
                        executionEnd: job.executionEnd,
                        maxDuration: formattedDuration,
                        runningStatus: job.runningStatus,
                        total: total,
                        untested: untested,
                        passed: passed,
                        skipped: skipped,
                        failed: failed,
                        ignored: ignored,
                        warning: warning,
                        percentage: percentage,
                        latestJobIds: job._id,
                        // ...(screenshot != null && {
                        //     failedTestCaseStepScreenshot: screenshot,
                        // }),
                        ...(screenshotData != null && {
                            failedTestCaseStepScreenshot: screenshotData,
                        }),
                        ...(logData != null && {
                            failedTestCaseStepLog: logData,
                        }),
                    }
                    updatedReleases.push(mergedObj)
                }
            }
        }

        if (multiModuleReleaseIds.length > 0) {
            jobs = await Job.aggregate([
                {
                    $match: {
                        $or: multiModuleReleases.map((release) => ({
                            releaseID: String(release._id),
                            version: release.testRunVersion,
                        })),
                    },
                },
            ])
            for (const release of multiModuleReleases) {
                let total = 0
                let untested = 0
                let passed = 0
                let skipped = 0
                let failed = 0
                let ignored = 0
                let warning = 0
                let percentage = 0
                let status
                let formattedDuration
                let jobIdsList = []
                let allJobs = jobs.filter((job) => job.releaseID == release._id)
                for (let job of allJobs) {
                    if (job) {
                        const testRun = job?.testRun
                        if (includeFailedTestCaseStepDetails == 'true') {
                            if (testRun[0]?.status === 'FAILED') {
                                let result =
                                    await readFailedTestCaseStepDetails(job)
                                screenshotData = result?.screenShotData
                                logData = result?.logData
                            }
                        }
                        const statusCounts =
                            responseTransformer.getStatusCounts(testRun)
                        total += statusCounts?.total
                        untested += statusCounts?.untested
                        passed += statusCounts?.passed
                        skipped += statusCounts?.skipped
                        failed += statusCounts?.failed
                        ignored += statusCounts?.ignored
                        warning += statusCounts?.warning
                        percentage = parseInt((passed / total) * 100, 10)
                        jobIdsList.push(job._id)
                    }
                }

                let obj = getMultiJobsExecDuration(allJobs)
                formattedDuration = obj.formattedTimeDifference
                if (!formattedDuration) formattedDuration = '0m 0s'
                const jobRunning = allJobs.some((job) => {
                    return !['completed', 'aborted', 'manual'].includes(
                        job.runningStatus.toLowerCase()
                    )
                })
                if (jobRunning) status = 'In Progress'
                else status = 'Completed'

                mergedObj = {
                    _id: release._id,
                    releaseName: release.releaseName,
                    description: release.description,
                    version: release.version,
                    releaseDate: release.releaseDate,
                    schedule: release.schedule,
                    createdBy: release.createdBy,
                    createdAt: release.createdAt,
                    updatedAt: release.updatedAt,
                    __v: release.__v,
                    testRunVersion: release.testRunVersion,
                    executionStart: obj.executionStart,
                    executionDuration: formattedDuration,
                    executionEnd: obj.executionEnd,
                    maxDuration: formattedDuration,
                    runningStatus: status,
                    total: total,
                    untested: untested,
                    passed: passed,
                    skipped: skipped,
                    failed: failed,
                    ignored: ignored,
                    warning: warning,
                    percentage: percentage,
                    latestJobIds: jobIdsList,
                    // ...(screenshot != null && {
                    //     failedTestCaseStepScreenshot: screenshot,
                    // }),
                    ...(screenshotData != null && {
                        failedTestCaseStepScreenshot: screenshotData,
                    }),
                    ...(logData != null && {
                        failedTestCaseStepLog: logData,
                    }),
                }
                updatedReleases.push(mergedObj)
            }
        }
        // Sorting releases on the basis of executionEnd timestamp attribute
        updatedReleases = updatedReleases.sort(
            // Decreasing order
            (a, b) => new Date(b.executionEnd) - new Date(a.executionEnd)
        )
        res.send({ status: 200, message: 'Sucesss', data: updatedReleases })
    } catch (error) {
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

const getMultiJobsExecDuration = (jobs) => {
    let formattedTimeDifference = null
    let executionStart = null
    let executionEnd = null
    const jobStarts = Array.from(
        new Set(jobs.map((u) => new Date(u.executionStart)))
    )

    const jobEnds = Array.from(
        new Set(jobs.map((u) => new Date(u.executionEnd)))
    )
    const validStartDates = []

    for (const date of jobStarts) {
        const newDate = new Date(date)

        if (newDate.toString() !== 'Invalid Date') {
            validStartDates.push(newDate)
        }
    }

    const validEndDates = []

    for (const date of jobEnds) {
        const newDate = new Date(date)

        if (newDate.toString() !== 'Invalid Date') {
            validEndDates.push(newDate)
        }
    }

    const starttime = Math.max(...validEndDates)
    const endtime = Math.min(...validStartDates)

    if (validEndDates?.length && validStartDates?.length) {
        let timeDiffInMilliseconds = starttime - endtime

        let timeDiffInSeconds = Math.abs(timeDiffInMilliseconds) / 1000

        let minutes = Math.floor(timeDiffInSeconds / 60)
        let seconds = Math.floor(timeDiffInSeconds % 60)

        formattedTimeDifference = `${minutes !== 0 ? `${minutes}m` : ''} ${seconds}s`
        executionStart = moment(endtime)
        executionEnd = moment(starttime)
    }
    return { formattedTimeDifference, executionStart, executionEnd }
}

// Get Updated Executing Jira Jobs
router.get('/jobStatusDetail/:ids', async (req, res) => {
    let jobIds = req.params.ids.split(',')
    const { includeFailedTestCaseStepDetails } = req.query
    let modules = []
    let newJob = []
    let releaseIds = []
    let releases = []
    let jobs,
        percentage,
        total,
        untested,
        passed,
        failed,
        skipped,
        ignored,
        warning
    let screenshotData
    let logData
    try {
        jobs = await Job.find({
            _id: { $in: jobIds },
        })
        jobs.forEach((job) => {
            releaseIds.push(job.releaseID)
        })
        releases = await Release.find({
            _id: { $in: releaseIds },
        })
        for (let i = 0; i < jobs.length; i++) {
            const releaseID = jobs[i].releaseID
            const release = releases.find((rel) => rel._id + '' === releaseID)
            const releaseName = release.releaseName
            const {
                _id,
                jenkinsJobID,
                jenkinsJobName,
                jenkinsPath,
                createdBy,
                createdAt,
                updatedAt,
                __v,
                testRun,
                executionStart,
                executionEnd,
                executionDuration,
                lambdatest,
                linuxScreenRecord,
                runningStatus,
            } = jobs[i]
            modules = []
            const statusCounts = responseTransformer.getStatusCounts(testRun)
            total = statusCounts?.total || 0
            untested = statusCounts?.untested || 0
            passed = statusCounts?.passed || 0
            skipped = statusCounts?.skipped || 0
            failed = statusCounts?.failed || 0
            ignored = statusCounts?.ignored || 0
            warning = statusCounts?.warning || 0
            percentage = statusCounts?.percentage || 0
            if (includeFailedTestCaseStepDetails == 'true') {
                // Fetch screenshot and log against failed test case step from stored location
                if (testRun[0]?.status === 'FAILED') {
                    let result = await readFailedTestCaseStepDetails(jobs[i])
                    screenshotData = result?.screenShotData
                    logData = result?.logData
                }
            }
            testRun?.forEach((run) => {
                const { testNodes, moduleID } = run || []
                modules.push({
                    moduleID,
                    testNodes,
                })
            })
            // const formattedDuration = moment(
            //     new Date(parseInt(executionDuration, 10))
            // ).format('m[m] s[s]')
            const formattedDuration = moment
                .utc(moment(executionEnd).diff(moment(executionStart)))
                .format('m[m] s[s]')
            const moduleId = modules[0]?.moduleID
            // select is used to fetch only needed fields
            // lean method
            // 1. Converts Mongoose documents into plain JavaScript objects
            // 2. Speeds up read queries by skipping Mongoose processing.
            // 3. No Mongoose methods (.save(), .populate(), .validate()) available.
            const module = await Module.findById(moduleId)
                .select('suiteName')
                .lean()
            const moduleName = module.suiteName
            newJob.push({
                _id,
                testRun: `${moduleName}_${jenkinsJobID}`,
                createdBy,
                createdAt,
                updatedAt,
                __v,
                releaseName,
                jenkinsJobName,
                total,
                untested,
                passed,
                skipped,
                failed,
                ignored,
                warning,
                percentage,
                executionStart,
                executionEnd,
                executionDuration: executionDuration ? formattedDuration : '',
                lambdatest,
                linuxScreenRecord,
                runningStatus,
                ...(screenshotData != null && {
                    failedTestCaseStepScreenshot: screenshotData,
                }),
                ...(logData != null && {
                    failedTestCaseStepLog: logData,
                }),
            })
        }
        res.send({ status: 200, message: 'Sucesss', data: newJob })
    } catch (error) {
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

// Get latest test run user name for a release
router.get('/latestTestRunUser/:id/:type', async (req, res) => {
    try {
        let release
        let job
        if (req.params.type == 'release') {
            release = await Release.findById(req.params.id)
                .select('testRunVersion')
                .lean()

            job = await Job.findOne({
                releaseID: String(release._id),
                version: release.testRunVersion,
            })
                .select('createdBy')
                .lean()
        } else {
            job = await Job.findById(req.params.id).select('createdBy').lean()
        }

        let userName = await User.findById(job.createdBy)
            .select('firstName lastName')
            .lean()
        userName = userName.firstName + ' ' + userName.lastName
        res.send({ status: 200, message: 'Sucesss', data: userName })
    } catch (error) {
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

// Read Failed Test Case Step Screenshot file against a test run
const readFailedTestCaseStepDetails = async (job) => {
    try {
        let screenShotFilePath
        let logFilePath
        let screenShotData
        let logData
        let actualTestCaseStepDescription
        for (const testNode of job?.testRun[0]?.testNodes) {
            if (testNode?.status === 'FAILED') {
                for (const testCaseStep of testNode?.testCaseSteps) {
                    if (testCaseStep?.status === 'FAILED') {
                        screenShotFilePath = testCaseStep?.testStepResultsFile
                        // For manual test run
                        actualTestCaseStepDescription =
                            testCaseStep?.actualTestCaseStep
                        // For automated test run
                        if (actualTestCaseStepDescription == null)
                            logFilePath = testCaseStep?.testStepLogsFile
                        break // breaks inner loop
                    }
                }
                if (screenShotFilePath) break // breaks outer loop
            }
        }

        if (process.env.MOUNT_SHARE) {
            screenShotData =
                await getScreenshotFromMountLocation(screenShotFilePath)
            logData = logFilePath
                ? {
                      type: 'file',
                      content: await getLogFromMountLocation(logFilePath),
                  }
                : { type: 'string', content: actualTestCaseStepDescription }
            if (logData.type == 'file')
                logData = extractValueFromLogFile(logData.content)
            else logData = logData.content
            return { screenShotData, logData }
        }

        if (process.env.AWS_S3_ENDPOINT) {
            let screenshotParams = screenShotFilePath
                ? {
                      Bucket: process.env.AWS_S3_BUCKET,
                      Key: screenShotFilePath,
                  }
                : ''

            let logParams = logFilePath
                ? {
                      Bucket: process.env.AWS_S3_BUCKET,
                      Key: logFilePath,
                  }
                : ''

            screenShotData = await getObjectFromS3(screenshotParams)

            logData = logParams?.Key
                ? { type: 'file', content: await getObjectFromS3(logParams) }
                : { type: 'string', content: actualTestCaseStepDescription }
            if (logData.type == 'file')
                logData = extractValueFromLogFile(logData.content)
            else logData = logData.content
            return { screenShotData, logData }
        }
        logger.warn(
            'No storage backend configured. Could not fetch screenshot.'
        )
        return null
    } catch (error) {
        logger.error('Error in readFailedTestCaseStepDetails:', error)
        return null
    }
}

const updateStatus = (check, update) => {
    if (check.every((tcs) => tcs.status === 'PASSED')) {
        update.status = 'PASSED'
    } else if (check.some((tcs) => tcs.status === 'FAILED')) {
        update.status = 'FAILED'
    } else if (check.some((tcs) => tcs.status === 'RUNNING')) {
        update.status = 'RUNNING'
    }
    if (check.some((tcs) => tcs.status === 'IGNORED')) {
        update.status = 'IGNORED'
    }
    if (check.some((tcs) => tcs.status === 'WARNING')) {
        update.status = 'WARNING'
    }
}

router.patch('/jobUpdate/:jobID', async (req, res) => {
    try {
        const job = await Job.findById(req.params.jobID)
        // , (err, job) => {
        // responseTransformer.passthroughError(
        //     null,
        //     job,
        //     'find job',
        //     res,
        //     (job) => {

        if (req.body.reportPortalUrl)
            job['reportPortal']['url'] = req.body.reportPortalUrl
        job['jenkinsJobName'] = req.body?.jenkinsJobName
        job['jenkinsBuildNumber'] = req.body?.jenkinsBuildNumber
        if (req.body?.runningStatus)
            job['runningStatus'] = req.body?.runningStatus
        if (req?.body?.ltVideoUrl) {
            job['lambdatest']['video'] = req.body.ltVideoUrl
        }
        if (req?.body?.ltVideoStatus) {
            job['lambdatest']['status'] = req.body.ltVideoStatus
        }

        const updatedJob = await Job.findByIdAndUpdate(req.params.jobID, job, {
            new: true,
        })
        // , job, (err, job) =>

        responseTransformer.passthroughError(
            null,
            updatedJob,
            'update job',
            res,
            (job) =>
                res.json({
                    id: req.params.jobID,
                    url: req.body.reportPortalUrl,
                })
        )
        // )
        // }
        // )
        // })
        // let auditsave = common.UserAudit("64a7b2ea81b8b505b1ddddc9","RELEASE","/updated/"+req.params.id,"UPDATE","SUCCESS","Updated Successfully",req.params.id,chdataObj);
    } catch (error) {
        logger.info(`Encountered issue while updating job ${error}`)
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

const s3 = new S3Client({
    endpoint: process.env.AWS_S3_ENDPOINT,
    region: process.env.AWS_DEFAULT_REGION,
    forcePathStyle: true,
})

const sharedStorage = process.env.SMB_SHARE
const mountStorage = process.env.MOUNT_SHARE

if (sharedStorage) {
    IMAGES_ROOT_FOLDER = sharedStorage
    LOGS_ROOT_FOLDER = sharedStorage
}

if (mountStorage) {
    IMAGES_ROOT_FOLDER = mountStorage
    LOGS_ROOT_FOLDER = mountStorage
}

// console.log('sharedStorage', sharedStorage)
// console.log('IMAGES_ROOT_FOLDER', IMAGES_ROOT_FOLDER)
// console.log('LOGS_ROOT_FOLDER', LOGS_ROOT_FOLDER)

// if (sharedStorage) {
//     responseTransformer.getSMBClient()
// }

const uploadFileToS3 = async (req, jobId, testStepId, file, content) => {
    logger.info('File upload request for jobId ' + jobId)
    return new Promise((resolve, reject) => {
        const uploadParams = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: file,
            Body: content.toString(),
        }
        s3.send(new PutObjectCommand(uploadParams))
            .then(() => {
                logger.info('File uploaded successfully for jobId ' + jobId)
                resolve(true)
            })
            .catch((err) => {
                logger.error(
                    `Error uploading the file to S3 for jobId ${jobId}`,
                    {
                        stack: err.stack,
                    }
                )
                reject(err)
            })
    })
}

const uploadVideoFileToS3 = async (fileStream, key, jobId) => {
    logger.info('File upload request for jobId ', jobId)
    return new Promise((resolve, reject) => {
        // const fileStream = fs.createReadStream(filePath)
        const uploadParams = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
            Body: fileStream,
            ContentType: 'video/mp4',
        }
        s3.send(new PutObjectCommand(uploadParams))
            .then(() => {
                logger.info('File uploaded successfully for jobId ' + jobId)
                resolve(true)
            })
            .catch((err) => {
                console.log('err', err)
                logger.error(
                    `Error uploading the file to S3 for jobId ${jobId}`,
                    {
                        stack: err.stack,
                    }
                )
                reject(err)
            })
    })
}

const uploadVideoFileToSharedFolder = async (
    fileStream,
    filePath,
    fileName,
    jobId
) => {
    logger.info('File upload request for jobId ', jobId)
    return new Promise((resolve, reject) => {
        // const fileStream = fs.createReadStream(filePath)
        const smbFolderPath = path.join(sharedStorage, filePath)
        const smbFilePath = path.join(smbFolderPath, fileName)
        console.log('smbFolderPath', smbFolderPath)
        console.log('smbFilePath', smbFilePath)
    })
}

const uploadVideoFileToMountFolder = async (
    fileStream,
    filePath,
    fileName,
    jobId
) => {
    logger.info('File upload request for jobId ', jobId)
    try {
        // const fileStream = fs.createReadStream(filePath)
        const mountFolderPath = path.join(mountStorage, filePath)
        const mountFilePath = path.join(mountFolderPath, fileName)
        if (!fs.existsSync(mountFolderPath)) {
            fs.mkdirSync(mountFolderPath, { recursive: true })
        }
        // if (!fs.existsSync(mountFilePath)) {
        fs.writeFileSync(mountFilePath, fileStream, function (err) {
            logger.info('A new text file was created successfully.')
        })
        logger.info('A new text file was created successfully.')
    } catch (err) {
        console.log('error saving file to shared location')
    }
}

const appendScreenshot = (deleteFile, file, testStepId, screenshot) => {
    try {
        if (!fs.existsSync(IMAGES_ROOT_FOLDER)) {
            fs.mkdirSync(IMAGES_ROOT_FOLDER, { recursive: true })
        }
        if (!fs.existsSync(IMAGES_ROOT_FOLDER + file)) {
            fs.writeFileSync(
                IMAGES_ROOT_FOLDER + file,
                ' **TestResults**  ',
                function (err) {
                    logger.info('A new text file was created successfully.')
                }
            )
        }
        const text = testStepId + ' ' + screenshot + ' && '
        fs.appendFileSync(IMAGES_ROOT_FOLDER + file, text, function (err) {
            logger.info('A new text file was created successfully.')
        })
    } catch (err) {
        logger.error('err', err)
    }
}
const appendLog = (deleteFile, file, testStepId, log) => {
    try {
        if (!fs.existsSync(LOGS_ROOT_FOLDER)) {
            fs.mkdirSync(LOGS_ROOT_FOLDER, { recursive: true })
        }
        if (!fs.existsSync(LOGS_ROOT_FOLDER + file)) {
            fs.writeFileSync(
                LOGS_ROOT_FOLDER + file,
                ' **TestResults**  ',
                function (err) {
                    logger.info('A new text file was created successfully.')
                }
            )
        }
        const text = testStepId + ' ' + log + ' && '
        fs.appendFileSync(LOGS_ROOT_FOLDER + file, text, function (err) {
            logger.info('A new text file was created successfully.')
        })
    } catch (err) {
        logger.error('err', err)
    }
}

const saveScreenshotToSharedLocation = (
    deleteFile,
    filePath,
    fileName,
    testStepId,
    screenshot
) => {
    try {
        const smbFilePath = path.join(filePath, fileName)
        if (screenshot[0] !== null) {
            responseTransformer.writeFileToSMBPath(
                null,
                filePath,
                smbFilePath,
                screenshot[0]
            )
        }
    } catch (err) {
        logger.error('err', err)
    }
}

const saveLogToSharedLocation = (
    deleteFile,
    filePath,
    fileName,
    testStepId,
    log
) => {
    try {
        const smbFilePath = path.join(filePath, fileName)
        if (log !== null) {
            responseTransformer.writeFileToSMBPath(
                null,
                filePath,
                smbFilePath,
                log
            )
        }
    } catch (err) {
        logger.error('err', err)
    }
}

const saveScreenshotToMountLocation = (
    deleteFile,
    remotePath,
    file,
    testStepId,
    screenshot
) => {
    try {
        const mountFolderPath = path.join(IMAGES_ROOT_FOLDER, remotePath)
        const mountFilePath = path.join(mountFolderPath, file)
        if (!fs.existsSync(mountFolderPath)) {
            fs.mkdirSync(mountFolderPath, { recursive: true })
        }
        // if (!fs.existsSync(mountFilePath)) {
        fs.writeFileSync(mountFilePath, screenshot[0], function (err) {
            logger.info('A new text file was created successfully.')
        })
        // }
        // const text = testStepId + ' ' + screenshot + ' && '
        // fs.appendFileSync(IMAGES_ROOT_FOLDER + file, text, function (err) {
        //     logger.info('A new text file was created successfully.')
        // })
    } catch (err) {
        logger.error('err', err)
    }
}

const saveLogToMountLocation = (
    deleteFile,
    remotePath,
    file,
    testStepId,
    log
) => {
    try {
        const mountFolderPath = path.join(LOGS_ROOT_FOLDER, remotePath)
        const mountFilePath = path.join(mountFolderPath, file)
        if (!fs.existsSync(mountFolderPath)) {
            fs.mkdirSync(mountFolderPath, { recursive: true })
        }
        if (!fs.existsSync(mountFilePath)) {
            fs.writeFileSync(mountFilePath, log, function (err) {
                logger.info('A new text file was created successfully.')
            })
        }
        // const text = testStepId + ' ' + log + ' && '
        // fs.appendFileSync(LOGS_ROOT_FOLDER + file, text, function (err) {
        //     logger.info('A new text file was created successfully.')
        // })
    } catch (err) {
        logger.error('err', err)
    }
}

const uploadExcelFileToS3 = async (req, jobId, testStepId, file, content) => {
    logger.info('File upload request for jobId ' + jobId)
    return new Promise((resolve, reject) => {
        const uploadParams = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: file,
            Body: content, // ✅ keep as Buffer
            ContentType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }
        s3.send(new PutObjectCommand(uploadParams))
            .then(() => {
                logger.info('File uploaded successfully for jobId ' + jobId)
                resolve(true)
            })
            .catch((err) => {
                logger.error(
                    `Error uploading the file to S3 for jobId ${jobId}`,
                    {
                        stack: err.stack,
                    }
                )
                reject(err)
            })
    })
}

// const getScreenshotFromMountLocation = (remotePath) => {
//     let screenshot = null
//     try {
//         screenshot = fs.readFileSync(remotePath, {
//             flag: 'r',
//             encoding: 'utf8',
//         })
//     } catch (err) {
//         logger.error('err', err)
//     }
//     return screenshot
// }

// const getLogFromMountLocation = (remotePath) => {
//     let log = null
//     try {
//         log = fs.readFileSync(remotePath, {
//             flag: 'r',
//             encoding: 'utf8',
//         })
//     } catch (err) {
//         logger.error('err', err)
//     }
//     return log
// }

const getScreenshotFromMountLocation = async (remotePath) => {
    try {
        const screenshot = await fs.promises.readFile(
            path.join(process.env.MOUNT_SHARE, remotePath),
            {
                encoding: 'utf8',
            }
        )
        return screenshot
    } catch (err) {
        logger.error('Error reading screenshot:', err)
        return null
    }
}

const getLogFromMountLocation = async (remotePath) => {
    try {
        const content = await fs.promises.readFile(
            path.join(process.env.MOUNT_SHARE, remotePath),
            {
                encoding: 'utf8',
            }
        )
        return content
    } catch (err) {
        logger.error('err', err)
        return null
    }
}

// The below is to extract failed test case step description
// against "Actual Value" from log file

const extractValueFromLogFile = (content) => {
    // Split into lines
    const lines = content.replace(/\r\n/g, '\n').split('\n')

    // Extract "Actual Value" strings
    const actualValue = lines
        .filter((line) => line.includes('Actual Result:'))
        .map((line) => {
            const match = line.match(/Actual Result:\s*(.*)$/)
            return match ? match[1].trim() : null
        })
        .filter(Boolean) // remove nulls
    return actualValue[0]
}

router.patch('/jobUpdate/:jobID/:id/:status', async (req, res) => {
    try {
        const deleteFile = req.body.deleteFile
        const moduleId = req.body.moduleId
        const testCaseId = req.body.testCaseId
        const screenshot = req.body.images
        const log = req.body.log
        const jobExecutionStart = req.body.jobExecutionStart
        const executionStart = req.body.executionStart
        const executionEnd = req.body.executionEnd
        const executionDuration = req.body.executionDuration
        const moduleDuration = req.body.moduleDuration
        const jobDuration = req.body.jobDuration
        const testNodeId = req.body.testNodeId

        let moduleExecutionStart = null

        const file =
            'TestResults_' +
            req.params.jobID +
            '_' +
            moduleId +
            '_' +
            testCaseId +
            '.txt'

        const job = await Job.findById(req.params.jobID)
        //  (err, job) => {
        // let auditsave = common.UserAudit("","JOBS","/jobUpdate/"+req.params.jobID,"UPDATE","SUCCESS","Updated Successfully",req.params.jobID,job);
        if (job) {
            responseTransformer.passthroughError(
                null,
                job,
                'find job',
                res,
                async (job) => {
                    let updated = false

                    job.testRun.forEach((testNode, index) => {
                        let failed = false

                        testNode.testNodes.forEach((testStep, index) => {
                            if (failed) {
                                testStep.status = JobStatus.SKIPPED
                            }

                            let idFound = false

                            logger.info(
                                `Going to iterate over test step with testNodeId ${testNode.testNodeID}`
                            )
                            testStep.testCaseSteps.forEach((ts) => {
                                if (failed) {
                                    ts.status = JobStatus.SKIPPED
                                }
                                if (ts._id.toString() === req.params.id) {
                                    idFound = true
                                    if (
                                        (testStep.status !==
                                            JobStatus.SKIPPED ||
                                            req.params.status !==
                                                JobStatus.SKIPPED) &&
                                        req.params.jobID &&
                                        moduleId &&
                                        testNodeId &&
                                        req.params.id
                                    ) {
                                        logger.info(`before append screenshot`)

                                        if (process.env.AWS_S3_BUCKET) {
                                            if (screenshot) {
                                                const screenshotPath = `jobs/${req.params.jobID}/${moduleId}/${testNodeId}/images/${req.params.id}.txt`
                                                uploadFileToS3(
                                                    req,
                                                    req.params.jobID,
                                                    req.params.id,
                                                    screenshotPath,
                                                    screenshot
                                                )
                                                ts.testStepResultsFile = `${screenshotPath}`
                                            }

                                            if (log) {
                                                const logFilePath = `jobs/${req.params.jobID}/${moduleId}/${testNodeId}/logs/${req.params.id}.txt`
                                                uploadFileToS3(
                                                    req,
                                                    req.params.jobID,
                                                    req.params.id,
                                                    logFilePath,
                                                    log
                                                )
                                                ts.testStepLogsFile = `${logFilePath}`
                                            }
                                        } else if (sharedStorage) {
                                            const screenshotPath = path.join(
                                                'jobs',
                                                req.params.jobID,
                                                moduleId,
                                                testNodeId,
                                                'images'
                                            )

                                            const logFilePath = path.join(
                                                'jobs',
                                                req.params.jobID,
                                                moduleId,
                                                testNodeId,
                                                'logs'
                                            )

                                            saveScreenshotToSharedLocation(
                                                deleteFile,
                                                screenshotPath,
                                                `${req.params.id}.txt`,
                                                req.params.id,
                                                screenshot
                                            )
                                            saveLogToSharedLocation(
                                                deleteFile,
                                                logFilePath,
                                                `${req.params.id}.txt`,
                                                req.params.id,
                                                log
                                            )
                                            ts.testStepResultsFile = path.join(
                                                screenshotPath,
                                                `${req.params.id}.txt`
                                            )
                                            ts.testStepLogsFile = path.join(
                                                logFilePath,
                                                `${req.params.id}.txt`
                                            )
                                        } else if (mountStorage) {
                                            const screenshotPath = path.join(
                                                'jobs',
                                                req.params.jobID,
                                                moduleId,
                                                testNodeId,
                                                'images'
                                            )

                                            const logFilePath = path.join(
                                                'jobs',
                                                req.params.jobID,
                                                moduleId,
                                                testNodeId,
                                                'logs'
                                            )

                                            saveScreenshotToMountLocation(
                                                deleteFile,
                                                screenshotPath,
                                                `${req.params.id}.txt`,
                                                req.params.id,
                                                screenshot
                                            )
                                            saveLogToMountLocation(
                                                deleteFile,
                                                logFilePath,
                                                `${req.params.id}.txt`,
                                                req.params.id,
                                                log
                                            )
                                            ts.testStepResultsFile = path.join(
                                                screenshotPath,
                                                `${req.params.id}.txt`
                                            )
                                            ts.testStepLogsFile = path.join(
                                                logFilePath,
                                                `${req.params.id}.txt`
                                            )
                                        }
                                    }
                                    ts.status = req.params.status

                                    updated = true
                                    if (
                                        req.params.status === JobStatus.FAILED
                                    ) {
                                        failed = true
                                    }
                                }
                            })

                            if (executionStart && idFound) {
                                testStep.executionStart = executionStart
                                if (parseInt(index, 10) === 0)
                                    moduleExecutionStart = executionStart
                            }
                            if (executionEnd && idFound)
                                testStep.executionEnd = executionEnd
                            if (executionDuration && idFound)
                                testStep.executionDuration = executionDuration

                            if (
                                testStep.status !== JobStatus.SKIPPED &&
                                testStep.testNodeID === req.params.id &&
                                !process.env.AWS_S3_BUCKET
                            ) {
                                testStep.testCaseResultsFile = file
                                testStep.testCaseLogsFile = file
                            }

                            updateStatus(testStep.testCaseSteps, testStep)
                            if (testStep.testNodeID === req.params.id) {
                                if (
                                    testStep.status !== JobStatus.SKIPPED &&
                                    screenshot &&
                                    !process.env.AWS_S3_BUCKET
                                ) {
                                    appendScreenshot(
                                        deleteFile,
                                        file,
                                        req.params.id,
                                        screenshot
                                    )
                                    appendLog(
                                        deleteFile,
                                        file,
                                        req.params.id,
                                        log
                                    )
                                }
                                testStep.status = req.params.status
                                updated = true
                            }
                        })

                        if (testNode.moduleID === moduleId) {
                            if (moduleExecutionStart)
                                testNode.executionStart = moduleExecutionStart
                            if (executionEnd)
                                testNode.executionEnd = executionEnd
                            if (moduleDuration)
                                testNode.executionDuration = moduleDuration
                        }

                        updateStatus(testNode.testNodes, testNode)
                        if (testNode.moduleID === req.params.id) {
                            testNode.status = req.params.status
                            updated = true
                        }
                    })

                    if (jobExecutionStart)
                        job.executionStart = jobExecutionStart
                    if (executionEnd) job.executionEnd = executionEnd
                    if (jobDuration) job.executionDuration = jobDuration
                    if (updated) {
                        const updatedJob = await Job.findByIdAndUpdate(
                            req.params.jobID,
                            job
                        )
                        // (err, job) => {
                        // if (err) {
                        //     res.send({
                        //         status: '400',
                        //         Message: 'Error While job update',
                        //         data: err,
                        //     })
                        // } else {

                        console.log(
                            '9410 process.env.ADO_INTEGRATION_APPLICABILITY',
                            process.env.ADO_INTEGRATION_APPLICABILITY
                        )

                        if (ADO_ENABLED) {
                            // Ado test run results update
                            ;(async () => {
                                console.log('9417 Ado test run results update')
                                try {
                                    let project =
                                        await common.getProjectNameById(
                                            job.projectID
                                        )
                                    console.log('job', job)
                                    const moduleDetails = job?.testRun[0]
                                    console.log('moduleDetails', moduleDetails)
                                    const data =
                                        await jobService.formatAdoRequestBodyFromJob(
                                            job,
                                            moduleDetails
                                        )
                                    let adoRequestBody = {
                                        projectName: project.name,
                                        testRunId: job.adoTestRunId,
                                        testCasesResults:
                                            formatAdoTestResultsRequestBody(
                                                data
                                            ),
                                    }
                                    console.log('9425', adoRequestBody)
                                    const headers = {
                                        'Content-Type': 'application/json',
                                    }
                                    // const adoJob = await axios.patch(
                                    //     `${process.env.ADO_INTEGRATION_HOST}/api/test-results/updateAdoTestResultForTestRunById`,
                                    //     adoRequestBody,
                                    //     { headers }
                                    // )
                                } catch (err) {
                                    logger.error(
                                        `Error during ADO Test result call: ${err}`
                                    )
                                }
                            })()
                        }

                        responseTransformer.passthroughError(
                            null,
                            job,
                            'update job',
                            res,
                            (updatedJob) =>
                                res.json({
                                    _id: req.params.jobID,
                                    status: req.params.status,
                                })
                        )
                        // }
                        // }
                        // )
                    } else
                        res.status(400).json({
                            message: 'Not found',
                        })
                }
            )
        } else {
            res.send({ status: 400, message: 'Job Not Found !!', data: error })
        }

        // })
    } catch (error) {
        logger.info(`Encountered issue while updating job status ${error}`)
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

router.get('/jobJson/:id', async (req, res) => {
    try {
        Job.findById(req.params.id, (err, job) =>
            responseTransformer.passthroughError(
                err,
                job,
                'get job',
                res,
                async (job) => {
                    job = removeCircular(job)

                    const release = await Release.findById(job.releaseID)
                    const releaseModules = release?.toObject().modules

                    const testNodes = job.testRun
                    delete job.testRun
                    job.modules = await Promise.all(
                        testNodes.map(async (tc) => {
                            const moduleObj = releaseModules?.find(
                                (releaseModule) =>
                                    releaseModule.moduleID == tc.moduleID
                            )
                            const currentJobTestPlaceholders =
                                moduleObj?.testPlaceholders?.filter(
                                    (tp) => tp?.jobId?.toString() === job?._id
                                )[0]
                            if (currentJobTestPlaceholders) {
                                currentJobTestPlaceholders.jobId =
                                    currentJobTestPlaceholders?.jobId?.toString()
                            }
                            const module = await Module.findById(tc.moduleID)
                            const testNodes = new Map(
                                module
                                    .toObject()
                                    .testNodes.map((c) => [c._id.toString(), c])
                            )

                            const updatedTestNodes = []
                            testNodes.forEach((testNode, index) => {
                                const tnindex = index
                                const tempTestNode = { ...testNode }
                                tempTestNode._id = tempTestNode._id.toString()
                                tempTestNode?.testNode[0]?.testCaseSteps.forEach(
                                    (ts, index) => {
                                        const tpindex = index
                                        tempTestNode.testNode[0].testCaseSteps[
                                            tpindex
                                        ]._id =
                                            tempTestNode.testNode[0].testCaseSteps[
                                                tpindex
                                            ]._id.toString()
                                    }
                                )
                                updatedTestNodes.push(tempTestNode)
                            })
                            return {
                                _id: module._id,
                                projectID: module.projectID,
                                suiteName: module.suiteName,
                                suiteDescription: module.suiteDescription,
                                testPlaceholders: currentJobTestPlaceholders,
                                testNodes: updatedTestNodes,
                            }
                        })
                    )
                    res.json(job)
                }
            )
        )
    } catch (error) {
        res.json({ error })
    }
})

router.get('/v1/jobJson/:id', async (req, res) => {
    try {
        Job.findById(req.params.id, (err, job) =>
            responseTransformer.passthroughError(
                err,
                job,
                'get job',
                res,
                async (job) => {
                    let ReRunStatus
                    if (job.testRun.length) {
                        if (
                            job.testRun[job.testRun.length - 1].ReRunStatus ==
                            undefined
                        ) {
                            ReRunStatus = 0
                        } else {
                            ReRunStatus =
                                job.testRun[job.testRun.length - 1].ReRunStatus
                        }
                    }
                    job = removeCircular(job)

                    const release = await Release.findById(job.releaseID)
                    const releaseModules = release?.toObject().modules
                    // latest module should go not all check line 1981
                    const testNodes = job.testRun
                    delete job.testRun
                    job.modules = await Promise.all(
                        testNodes.map(async (tc) => {
                            const moduleObj = releaseModules?.find(
                                (releaseModule) =>
                                    releaseModule.moduleID == tc.moduleID
                            )
                            const currentJobTestPlaceholders =
                                moduleObj?.testPlaceholders?.filter(
                                    (tp) => tp?.jobId?.toString() === job?._id
                                )[0]
                            if (currentJobTestPlaceholders) {
                                currentJobTestPlaceholders.jobId =
                                    currentJobTestPlaceholders?.jobId?.toString()
                            }
                            const module = await Module.findById(tc.moduleID)
                            const testNodes = new Map(
                                module
                                    .toObject()
                                    .testNodes.map((c) => [c._id.toString(), c])
                            )

                            const updatedTestNodes = []
                            testNodes.forEach((testNode, index) => {
                                const tnindex = index
                                const tempTestNode = { ...testNode }
                                tempTestNode._id = tempTestNode._id.toString()
                                tempTestNode?.testNode[0]?.testCaseSteps.forEach(
                                    (ts, index) => {
                                        const tpindex = index
                                        tempTestNode.testNode[0].testCaseSteps[
                                            tpindex
                                        ]._id =
                                            tempTestNode.testNode[0].testCaseSteps[
                                                tpindex
                                            ]._id.toString()
                                    }
                                )
                                updatedTestNodes.push(tempTestNode)
                            })
                            // find ReRunStatus from job with moduleID == module._id as
                            return {
                                _id: module._id,
                                projectID: module.projectID,
                                suiteName: module.suiteName,
                                suiteDescription: module.suiteDescription,
                                testPlaceholders: currentJobTestPlaceholders,
                                testNodes: updatedTestNodes,
                            }
                        })
                    )
                    job.modules[0].ReRunStatus = ReRunStatus
                    // job.ReRunStatus = "1"  //last rerun status from Jobs.testRun[0].ReRunStatus Schema
                    res.json(job)
                }
            )
        )
    } catch (error) {
        res.json({ error })
    }
})

router.get('/v2/jobJson/:id', async (req, res) => {
    try {
        let job = await Job.findById(req.params.id)
        //  (err, job) =>
        //     responseTransformer.passthroughError(
        //         err,
        //         job,
        //         'get job',
        //         res,
        //         async (job) => {
        if (job) {
            job = removeCircular(job)

            const release = await Release.findById(job.releaseID)
            const releaseModules = release?.toObject().modules

            const testNodes = job.testRun
            delete job.testRun
            job.modules = await Promise.all(
                testNodes.map(async (tc) => {
                    const moduleObj = releaseModules?.find(
                        (releaseModule) => releaseModule.moduleID == tc.moduleID
                    )

                    const currentJobTestPlaceholders =
                        moduleObj?.testPlaceholders?.filter(
                            (tp) => tp?.jobId?.toString() === job?._id
                        )[0]
                    if (currentJobTestPlaceholders) {
                        currentJobTestPlaceholders.jobId =
                            currentJobTestPlaceholders?.jobId?.toString()
                    }
                    let module = await Module.findById(tc.moduleID)
                    module = await responseTransformer.getModulesDataWithSteps(
                        [module],
                        module?.projectID,
                        null,
                        null,
                        true,
                        false
                    )
                    module = module[0]
                    let jobTestNodes = tc.testNodes.map((c) =>
                        c.testNodeID.toString()
                    )

                    let tempJobNodes = []

                    jobTestNodes?.forEach((tNode) => {
                        let testNode = module.testNodes.find(
                            (node) => tNode.toString() === node._id.toString()
                        )
                        let dependsOn = testNode.testNode[0]?.dependsOn
                        let id = testNode._id
                        tempJobNodes.push(id)

                        while (dependsOn !== null && dependsOn !== '') {
                            const n = module.testNodes.find(
                                (node) =>
                                    dependsOn ===
                                    node.testNode[0]?.testCaseID.toString()
                            )

                            if (n) {
                                dependsOn = n.testNode[0]?.dependsOn
                                id = n._id
                                tempJobNodes.push(id)
                            }
                        }
                    })

                    jobTestNodes = [...new Set(tempJobNodes)]

                    const moduleTestNodes = module.testNodes?.filter(
                        (testNode) =>
                            jobTestNodes.includes(testNode._id.toString())
                    )

                    const testNodes = new Map(
                        moduleTestNodes.map((c) => [c._id.toString(), c])
                    )

                    const updatedTestNodes = []
                    testNodes.forEach((testNode, index) => {
                        const tnindex = index
                        const tempTestNode = { ...testNode }
                        tempTestNode._id = tempTestNode._id.toString()
                        const testCaseSteps =
                            tempTestNode?.testNode[0]?.testCaseSteps.forEach(
                                (ts, index) => {
                                    const tpindex = index
                                    tempTestNode.testNode[0].testCaseSteps[
                                        tpindex
                                    ]._id =
                                        tempTestNode.testNode[0].testCaseSteps[
                                            tpindex
                                        ]._id.toString()
                                }
                            )
                        updatedTestNodes.push(tempTestNode)
                    })
                    return {
                        _id: module._id,
                        projectID: module.projectID,
                        suiteName: module.suiteName,
                        suiteDescription: module.suiteDescription,
                        testPlaceholders: currentJobTestPlaceholders,
                        locatorProperties: module?.locatorProperties,
                        testNodes: updatedTestNodes,
                    }
                })
            )
            res.json(job)
        } else {
            res.json({ message: 'Job Not found !!' })
        }

        // }
        // )
        // )
    } catch (error) {
        logger.info(`Error fetching job json ${error}`)
        res.json({ error })
    }
})

// router.patch(
//     '/testCaseUpdate/:testRunId/:moduleID/:id/:testCaseId',
//     async (req, res, next) => {
//         try {
//             app.use(imageUpload())

//             let testCaseResultsFile

//             const testCase = { ...req.body }
//             const testStepsToDelete = {}
//             if (req.body.testStepsToDelete) {
//                 if (req.body.testStepsToDelete.constructor === Array) {
//                     req.body.testStepsToDelete.forEach((step) => {
//                         const stepId = step.split('_')[0]
//                         const indices = step.split('_')[1]
//                         testStepsToDelete[stepId] = indices
//                     })
//                 } else {
//                     const stepId = req.body.testStepsToDelete.split('_')[0]
//                     let indices = req.body.testStepsToDelete.split('_')[1]

//                     testStepsToDelete[stepId] = indices
//                 }
//             }

//             // const path = __dirname + "../../../public/images/";
//             const path = 'public/images/'

//             /** test case file Data consolidation starts**/
//             const jsonFile =
//                 path +
//                 'TestResults' +
//                 '_' +
//                 req.params.testRunId +
//                 '_' +
//                 req.params.moduleID +
//                 '_' +
//                 req.params.testCaseId +
//                 '.txt'

//             testCaseResultsFile =
//                 'TestResults' +
//                 '_' +
//                 req.params.testRunId +
//                 '_' +
//                 req.params.moduleID +
//                 '_' +
//                 req.params.testCaseId +
//                 '.txt'

//             const json_temp_File =
//                 path +
//                 'Temp_TestResults' +
//                 '_' +
//                 req.params.testRunId +
//                 '_' +
//                 req.params.moduleID +
//                 '_' +
//                 req.params.testCaseId +
//                 '.txt'

//             testCaseResultsFile =
//                 'TestResults' +
//                 '_' +
//                 req.params.testRunId +
//                 '_' +
//                 req.params.moduleID +
//                 '_' +
//                 req.params.testCaseId +
//                 '.txt'

//             let existingTestData
//             if (fs.existsSync(jsonFile)) {
//                 let resultTestCaseData = []
//                 let resultTestStepData = {}
//                 let fileContent = ' '
//                 let totalData
//                 let testStepStatuses = {}

//                 const existingTestData = fs.readFileSync(jsonFile, {
//                     flag: 'r',
//                     encoding: 'utf8',
//                 })
//                 if (existingTestData && existingTestData?.length > 0) {
//                     totalData = existingTestData.split('**TestResults**')
//                 }

//                 if (totalData && totalData?.length > 0) {
//                     /*Existing Test Case Data processing  */
//                     let existingTestCaseImages = totalData[0].split(' ')
//                     if (existingTestCaseImages) {
//                         existingTestCaseImages = existingTestCaseImages.filter(
//                             (entry) => entry.trim() !== ''
//                         )

//                         if (testCase?.testResultsToDelete) {
//                             existingTestCaseImages =
//                                 existingTestCaseImages.filter(
//                                     (image) =>
//                                         !testCase?.testResultsToDelete.includes(
//                                             existingTestCaseImages.indexOf(
//                                                 image
//                                             )
//                                         )
//                                 )
//                         }

//                         if (existingTestCaseImages.constructor === Array) {
//                             resultTestCaseData = [
//                                 ...resultTestCaseData,
//                                 ...existingTestCaseImages,
//                             ]
//                         } else {
//                             resultTestCaseData.push(existingTestCaseImages)
//                         }
//                     }

//                     /*********New Test Cases Data processing****/

//                     if (req.files) {
//                         if (req.files.testCaseScreenshots) {
//                             if (
//                                 req.files.testCaseScreenshots.constructor ===
//                                 Array
//                             ) {
//                                 req.files.testCaseScreenshots.forEach(
//                                     (screenshot, index) =>
//                                         (resultTestCaseData = [
//                                             ...resultTestCaseData,
//                                             `data:image/png;base64,${fileUtils.arrayBufferToBase64(
//                                                 screenshot?.data
//                                             )}` + ' ',
//                                         ])
//                                 )
//                             } else {
//                                 resultTestCaseData = [
//                                     ...resultTestCaseData,
//                                     `data:image/png;base64,${fileUtils.arrayBufferToBase64(
//                                         req.files.testCaseScreenshots?.data
//                                     )}`,
//                                 ]
//                             }
//                         }
//                     }

//                     /**Existing Test Steps Data Processing  */
//                     if (totalData[1] && totalData[1]?.length > 0) {
//                         let existingTestStepImages = totalData[1].split('&&')
//                         if (
//                             existingTestStepImages &&
//                             existingTestStepImages?.length > 0
//                         ) {
//                             existingTestStepImages =
//                                 existingTestStepImages.filter(
//                                     (entry) => entry.trim() !== ''
//                                 )

//                             let existingStepImages = {}

//                             existingTestStepImages.forEach((step, index) => {
//                                 step = step
//                                     .split(' ')
//                                     .filter((entry) => entry.trim() !== '')
//                                 const stepId = step[0]
//                                 const stepIdImages = step.slice(1)

//                                 if (testStepsToDelete[stepId]) {
//                                     if (stepIdImages.constructor === Array) {
//                                         const filetredImages =
//                                             stepIdImages.filter(
//                                                 (image, index) =>
//                                                     !testStepsToDelete[
//                                                         stepId
//                                                     ].includes(index)
//                                             )
//                                         if (filetredImages?.length > 0) {
//                                             existingStepImages[stepId] =
//                                                 filetredImages
//                                         }
//                                     } else {
//                                         if (
//                                             !Object.keys(
//                                                 testStepsToDelete
//                                             ).includes(stepId)
//                                         ) {
//                                             existingStepImages[stepId] =
//                                                 stepIdImages
//                                         }
//                                     }
//                                 } else {
//                                     if (stepIdImages.constructor === Array) {
//                                         existingStepImages[stepId] = [
//                                             ...stepIdImages,
//                                         ]
//                                     } else {
//                                         existingStepImages[stepId] =
//                                             stepIdImages
//                                     }
//                                 }
//                             })
//                             if (existingStepImages) {
//                                 resultTestStepData = {
//                                     ...existingStepImages,
//                                     ...resultTestStepData,
//                                 }
//                             }
//                         }

//                         /***New Steps data processing */
//                         if (req.files) {
//                             const stepIds = Object.keys(req.files).filter(
//                                 (key) => key !== 'testCaseScreenshots'
//                             )
//                             if (stepIds) {
//                                 let tempStepObj = {}
//                                 stepIds.forEach((stepId) => {
//                                     let tempStepData = []
//                                     if (
//                                         req.files[stepId].constructor === Array
//                                     ) {
//                                         tempStepData = [...req.files[stepId]]
//                                     } else {
//                                         tempStepData.push(req.files[stepId])
//                                     }

//                                     tempStepData.forEach((step, index) => {
//                                         tempStepData[index] =
//                                             `data:image/png;base64,${fileUtils.arrayBufferToBase64(
//                                                 tempStepData[index]?.data
//                                             )}`
//                                     })

//                                     tempStepObj[stepId] = tempStepData
//                                 })

//                                 Object.keys(tempStepObj).forEach((stepId) => {
//                                     if (resultTestStepData[stepId]) {
//                                         if (
//                                             resultTestStepData[stepId]
//                                                 .constructor === Array
//                                         ) {
//                                             resultTestStepData[stepId] = [
//                                                 ...resultTestStepData[stepId],
//                                                 ...tempStepObj[stepId],
//                                             ]
//                                         } else {
//                                             resultTestStepData[stepId] = [
//                                                 resultTestStepData[stepId],
//                                                 ...tempStepObj[stepId],
//                                             ]
//                                         }
//                                     } else {
//                                         resultTestStepData[stepId] = [
//                                             ...tempStepObj[stepId],
//                                         ]
//                                     }
//                                 })
//                             }
//                         }
//                     } //if (totalData[1] && totalData[1]?.length > 0)
//                 } //if (totalData && totalData?.length > 0)

//                 /*******************File Writing proces**************************************** */

//                 fs.writeFileSync(json_temp_File, '', (err) => {
//                     if (err) {
//                         console.error(err)
//                     }
//                 })

//                 /**-------Writing Test Cases ------------**/
//                 fileContent = ' '
//                 if (resultTestCaseData && resultTestCaseData?.length > 0) {
//                     resultTestCaseData.forEach((item) => {
//                         fileContent = fileContent + item + ' '
//                     })
//                 }
//                 fileContent = fileContent + ' **TestResults** '
//                 fs.appendFileSync(json_temp_File, fileContent)
//                 fileContent = ' '

//                 /**-------Writing Test Steps ------------- */
//                 if (
//                     resultTestStepData &&
//                     Object.keys(resultTestStepData)?.length > 0
//                 ) {
//                     const stepIds = Object.keys(resultTestStepData)
//                     if (stepIds?.length > 0) {
//                         stepIds.forEach((stepId) => {
//                             fileContent = fileContent + ` ${stepId} `
//                             if (
//                                 resultTestStepData[stepId].constructor === Array
//                             ) {
//                                 resultTestStepData[stepId].forEach(
//                                     (image) =>
//                                         (fileContent =
//                                             fileContent + image + ' ')
//                                 )
//                             } else {
//                                 fileContent =
//                                     fileContent +
//                                     resultTestStepData[stepId] +
//                                     ' '
//                             }

//                             fileContent = fileContent + ' && '
//                         })
//                     }
//                 }

//                 fs.appendFileSync(json_temp_File, fileContent)
//                 fileContent = ' '

//                 /**overwriting the original file */

//                 const updatedReadStream = fs.readFileSync(json_temp_File, {
//                     encoding: 'utf8',
//                 })
//                 fs.writeFileSync(jsonFile, '')
//                 fs.writeFileSync(jsonFile, updatedReadStream)
//                 fs.unlinkSync(json_temp_File)
//             } //if (fs.existsSync(jsonFile))

//             /**********if the file does not already exists**************/
//             else {
//                 if (req?.files) {
//                     let writeStream = fs.writeFile(jsonFile, '', (err) => {
//                         if (err) {
//                             console.error(err)
//                         }
//                         // file written successfully
//                     })
//                     writeStream = fs.createWriteStream(jsonFile, { flags: 'a' })

//                     const testCaseScreenshots = req?.files?.testCaseScreenshots

//                     if (testCaseScreenshots) {
//                         if (testCaseScreenshots) {
//                             if (testCaseScreenshots.constructor === Array) {
//                                 testCaseScreenshots.forEach(
//                                     (screenshot, index) =>
//                                         writeStream.write(
//                                             `data:image/png;base64,${fileUtils.arrayBufferToBase64(
//                                                 screenshot?.data
//                                             )}` + ' '
//                                         )
//                                 )
//                             } else {
//                                 writeStream.write(
//                                     `data:image/png;base64,${fileUtils.arrayBufferToBase64(
//                                         testCaseScreenshots?.data
//                                     )}` + ' '
//                                 )
//                             }
//                         }
//                         writeStream.write(' **TestResults** ')
//                     }

//                     /** step Files Logic **/

//                     const stepIds = Object.keys(req.files).filter(
//                         (key) => key !== 'testCaseScreenshots'
//                     )
//                     if (stepIds) {
//                         if (!testCaseScreenshots) {
//                             writeStream.write(' **TestResults** ')
//                         }
//                     }

//                     stepIds.forEach((stepId) => {
//                         writeStream.write(` ${stepId} `)
//                         if (req.files[stepId].constructor === Array) {
//                             req.files[stepId].forEach((screenshot) =>
//                                 writeStream.write(
//                                     `data:image/png;base64,${fileUtils.arrayBufferToBase64(
//                                         screenshot?.data
//                                     )}` + ' '
//                                 )
//                             )
//                         } else {
//                             writeStream.write(
//                                 `data:image/png;base64,${fileUtils.arrayBufferToBase64(
//                                     req.files[stepId]?.data
//                                 )}` + ' '
//                             )
//                         }

//                         writeStream.write(' && ')
//                     })

//                     writeStream.on('finish', () => {
//                         logger.info(
//                             `wrote all the array data to file ${jsonFile}`
//                         )
//                     })

//                     writeStream.on('error', (err) => {
//                         logger.info(
//                             `There is an error writing the file ${jsonFile} => ${err}`
//                         )
//                     })

//                     writeStream.end()
//                 }
//             } //if its a new FIle

//             Job.findById(req.params.testRunId, (err, job) => {
//                 responseTransformer.passthroughError(
//                     err,
//                     job,
//                     'find job',
//                     res,
//                     (job) => {
//                         let updated = false

//                         job.testRun.forEach((module) => {
//                             if (module.moduleID === req.params.moduleID) {
//                                 module.testNodes.forEach((testNode) => {
//                                     if (
//                                         testNode.testNodeID.toString() ===
//                                         req.params.id
//                                     ) {
//                                         updated = true

//                                         if (testCase.testCaseStatus) {
//                                             if (
//                                                 testCase.testCaseStatus !==
//                                                 testNode?.status
//                                             ) {
//                                                 testNode.dateStatusLastUpdated =
//                                                     new Date()
//                                                 //.toISOString()
//                                                 // .replace(/[-:.]/g, "");
//                                             }
//                                             testNode.status =
//                                                 testCase.testCaseStatus
//                                         }
//                                         if (testCase?.screenShotComments) {
//                                             testNode.screenShotComments =
//                                                 testCase?.screenShotComments
//                                         }

//                                         if (
//                                             testCaseResultsFile &&
//                                             !process.env.AWS_S3_BUCKET
//                                         ) {
//                                             testNode.testCaseResultsFile =
//                                                 testCaseResultsFile
//                                         }

//                                         /**updating step status starts */
//                                         if (testCase?.stepStatus) {
//                                             let testStepStatus = {}
//                                             if (
//                                                 testCase?.stepStatus
//                                                     .constructor === Array
//                                             ) {
//                                                 testCase?.stepStatus.forEach(
//                                                     (step) => {
//                                                         const stepId =
//                                                             step.split('_')[0]
//                                                         const stepStatus =
//                                                             step.split('_')[1]
//                                                         testStepStatus[stepId] =
//                                                             stepStatus
//                                                     }
//                                                 )
//                                             } else {
//                                                 const stepId =
//                                                     testCase?.stepStatus.split(
//                                                         '_'
//                                                     )[0]
//                                                 const stepStatus =
//                                                     testCase?.stepStatus.split(
//                                                         '_'
//                                                     )[1]
//                                                 testStepStatus[stepId] =
//                                                     stepStatus
//                                             }

//                                             if (testStepStatus) {
//                                                 let testStepStatuses = {}
//                                                 testNode.testCaseSteps.forEach(
//                                                     (step) => {
//                                                         const modified_stepkeys =
//                                                             Object.keys(
//                                                                 testStepStatus
//                                                             )

//                                                         modified_stepkeys.forEach(
//                                                             (
//                                                                 stepKey,
//                                                                 index
//                                                             ) => {
//                                                                 modified_stepkeys[
//                                                                     index
//                                                                 ] =
//                                                                     modified_stepkeys[
//                                                                         index
//                                                                     ].trim()
//                                                             }
//                                                         )

//                                                         if (
//                                                             modified_stepkeys.includes(
//                                                                 step?._id.toString()
//                                                             )
//                                                         ) {
//                                                             updated = true
//                                                             step.status =
//                                                                 testStepStatus[
//                                                                     step?._id
//                                                                 ]
//                                                             testStepStatuses[
//                                                                 step?._id
//                                                             ] =
//                                                                 testStepStatus[
//                                                                     step?._id
//                                                                 ]
//                                                         } else {
//                                                             testStepStatuses[
//                                                                 step?._id
//                                                             ] = step.status
//                                                         }
//                                                     }
//                                                 )

//                                                 if (
//                                                     Object.values(
//                                                         testStepStatuses
//                                                     ).includes(JobStatus.FAILED)
//                                                 ) {
//                                                     testNode.status =
//                                                         JobStatus.FAILED
//                                                 }
//                                             }
//                                         }
//                                         /** Updating step status ends*/
//                                     }
//                                 })
//                             }
//                         })

//                         if (updated) {
//                             Job.findByIdAndUpdate(
//                                 req.params.testRunId,
//                                 job,
//                                 (err, job) => {
//                                     AuditCreation.upsertAuditLog(
//                                         job.collection.collectionName,
//                                         'update',
//                                         req.body?.email,
//                                         req.body?.company,
//                                         null,
//                                         job
//                                     )
//                                     responseTransformer.passthroughError(
//                                         err,
//                                         job,
//                                         'update job',
//                                         res,
//                                         (job) =>
//                                             res.json({
//                                                 job: job,
//                                             })
//                                     )
//                                 }
//                             )
//                         }
//                     }
//                 )
//             })
//         } catch (error) {
//             res.status(400).json({
//                 message:
//                     'Error updating the test case  testRunId = ' ||
//                     req.params.testRunId ||
//                     'moduleID =' ||
//                     req.params.moduleID ||
//                     'testCseId = ' ||
//                     req.params.id ||
//                     '_' ||
//                     error,
//             })
//         }
//     }
// )

router.patch(
    '/testCaseUpdate/:testRunId/:moduleId/:id/:testCaseId',
    async (req, res, next) => {
        try {
            const testCase = { ...req.body }
            let sharedFolderScreenshotPath
            let s3ScreenshotPath
            let base64Image
            let image
            let imageFileName
            let screenshotKeys = []
            let screenshotValues = []
            if (req.files) {
                screenshotKeys = Object.keys(req?.files)
                screenshotValues = Object.values(req?.files)
            }
            let job = await Job.findById(req.params.testRunId)

            if (!job) {
                return res.status(404).json({ message: 'Job not found' })
            }

            let updated = false

            job.testRun.forEach((module) => {
                if (module.moduleID === req.params.moduleId) {
                    module.testNodes.forEach((testNode) => {
                        if (testNode.testNodeID.toString() === req.params.id) {
                            updated = true

                            if (testCase.testCaseStatus) {
                                if (
                                    testCase.testCaseStatus !== testNode?.status
                                ) {
                                    testNode.dateStatusLastUpdated = new Date()
                                }
                                testNode.status = testCase.testCaseStatus
                            }

                            if (testCase?.screenShotComments) {
                                testNode.screenShotComments =
                                    testCase?.screenShotComments
                            }
                            // Update test Case file path here

                            if (
                                screenshotKeys.includes('testCaseScreenshots')
                            ) {
                                imageFileName = req.params.testCaseId
                                sharedFolderScreenshotPath = path.join(
                                    'jobs',
                                    req.params.testRunId,
                                    req.params.moduleId,
                                    req.params.testCaseId
                                    // 'images'
                                )
                                s3ScreenshotPath = `jobs/${req.params.testRunId}/${req.params.moduleId}/${req.params.testCaseId}/${req.params.testCaseId}.txt`
                                base64Image = `data:${screenshotValues[0].mimetype};base64,${screenshotValues[0].data.toString('base64')}`
                                image = [base64Image]
                                if (mountStorage) {
                                    saveScreenshotToMountLocation(
                                        '',
                                        sharedFolderScreenshotPath,
                                        `${imageFileName}.txt`,
                                        imageFileName,
                                        image
                                    )
                                    testNode.testCaseResultsFile = path.join(
                                        sharedFolderScreenshotPath,
                                        `${imageFileName}.txt`
                                    )
                                }
                                if (process.env.AWS_S3_BUCKET) {
                                    uploadFileToS3(
                                        req,
                                        req.params.testRunId,
                                        '',
                                        s3ScreenshotPath,
                                        image
                                    )
                                    testNode.testCaseResultsFile =
                                        s3ScreenshotPath
                                }
                            }

                            /** updating step status starts */
                            if (testCase?.stepStatus) {
                                let testStepStatus = {}

                                if (Array.isArray(testCase?.stepStatus)) {
                                    testCase?.stepStatus.forEach((step) => {
                                        const [stepId, stepStatus] =
                                            step.split('_')
                                        testStepStatus[stepId] = stepStatus
                                    })
                                } else {
                                    const [stepId, stepStatus] =
                                        testCase?.stepStatus.split('_')
                                    testStepStatus[stepId] = stepStatus
                                }

                                if (testStepStatus) {
                                    let testStepStatuses = {}
                                    testNode.testCaseSteps.forEach((step) => {
                                        const modified_stepkeys = Object.keys(
                                            testStepStatus
                                        ).map((key) => key.trim())

                                        if (
                                            modified_stepkeys.includes(
                                                step?._id.toString()
                                            )
                                        ) {
                                            updated = true
                                            step.status =
                                                testStepStatus[step?._id]
                                            testStepStatuses[step?._id] =
                                                testStepStatus[step?._id]
                                            // Update actual test case step attribute in DB, if test case step status is failed.
                                            // The attribute value will used in excel download from UI
                                            if (step.status == 'FAILED') {
                                                const parsedComment =
                                                    JSON.parse(
                                                        testCase?.screenShotComments
                                                    )
                                                step.actualTestCaseStep =
                                                    parsedComment?.blocks[0]?.text
                                            }
                                            if (screenshotKeys.length > 0) {
                                                // Update file storage along with path against test case step
                                                let index =
                                                    screenshotKeys.findIndex(
                                                        (id) => id === step._id
                                                    )
                                                if (index !== -1) {
                                                    imageFileName =
                                                        screenshotKeys[index]
                                                    sharedFolderScreenshotPath =
                                                        path.join(
                                                            'jobs',
                                                            req.params
                                                                .testRunId,
                                                            req.params.moduleId,
                                                            req.params
                                                                .testCaseId,
                                                            'images'
                                                        )
                                                    s3ScreenshotPath = `jobs/${req.params.testRunId}/${req.params.moduleId}/${req.params.testCaseId}/images/${screenshotKeys[index]}.txt`
                                                    base64Image = `data:${screenshotValues[index].mimetype};base64,${screenshotValues[index].data.toString('base64')}`
                                                    image = [base64Image]
                                                    if (mountStorage) {
                                                        saveScreenshotToMountLocation(
                                                            '',
                                                            sharedFolderScreenshotPath,
                                                            `${imageFileName}.txt`,
                                                            imageFileName,
                                                            image
                                                        )
                                                        step.testStepResultsFile =
                                                            path.join(
                                                                sharedFolderScreenshotPath,
                                                                `${imageFileName}.txt`
                                                            )
                                                    }
                                                    if (
                                                        process.env
                                                            .AWS_S3_BUCKET
                                                    ) {
                                                        uploadFileToS3(
                                                            req,
                                                            req.params
                                                                .testRunId,
                                                            '',
                                                            s3ScreenshotPath,
                                                            image
                                                        )
                                                        step.testStepResultsFile =
                                                            s3ScreenshotPath
                                                    }
                                                }
                                            }
                                        } else {
                                            testStepStatuses[step?._id] =
                                                step.status
                                        }
                                    })

                                    if (
                                        Object.values(
                                            testStepStatuses
                                        ).includes(JobStatus.FAILED)
                                    ) {
                                        testNode.status = JobStatus.FAILED
                                    }
                                }
                            }
                            /** Updating step status ends */
                        }
                    })
                }
            })

            if (updated) {
                const updatedJob = await Job.findByIdAndUpdate(
                    req.params.testRunId,
                    job,
                    { new: true }
                )

                await AuditCreation.upsertAuditLog(
                    updatedJob.collection.collectionName,
                    'update',
                    req.body?.email,
                    req.body?.company,
                    null,
                    updatedJob
                )

                return res.status(200).json({ job: updatedJob })
            } else {
                return res.status(400).json({ message: 'No changes made' })
            }
        } catch (error) {
            console.log(error)
            res.status(400).json({
                message:
                    'Error updating the test case  testRunId = ' ||
                    req.params.testRunId ||
                    'moduleId = ' ||
                    req.params.moduleId ||
                    'testCaseId = ' ||
                    req.params.id ||
                    '_' ||
                    error,
            })
        }
    }
)

router.get('/getTestCaseResults/:fileName', async (req, res) => {
    try {
        // const path = __dirname + "../../../public/images/";
        const path = 'public/images/'
        if (req.params.fileName) {
            if (fs.existsSync(path + req.params.fileName)) {
                const stream = fs.createReadStream(path + req.params.fileName)

                stream.on('open', () => {
                    res.set('Content-type', 'plain/text')
                    stream.pipe(res)
                })

                stream.on('error', (error) => {
                    res.set('Content-type', 'text/plain')
                    // res.status(404).end("Not found");
                })
            } else {
                res.json([])
            }
        } else {
            res.json([])
        }
    } catch (error) {
        res.json({ warnings: `${req.params.fileName} not valid file` })
    }
})

router.get('/getTestCaseLogs/:fileName', async (req, res) => {
    const warnings = []
    try {
        // const path = __dirname + "../../../public/images/";
        const path = LOGS_ROOT_FOLDER
        if (req.params.fileName) {
            if (fs.existsSync(path + req.params.fileName)) {
                const stream = fs.createReadStream(path + req.params.fileName)

                stream.on('open', () => {
                    res.set('Content-type', 'plain/text')
                    stream.pipe(res)
                })

                stream.on('error', (error) => {
                    res.set('Content-type', 'text/plain')
                    // res.status(404).end("Not found");
                })
            } else {
                res.json([])
            }
        } else {
            res.json([])
        }
    } catch (error) {
        logger.warn(`Encountered warnings while serving request: ${warnings}`)
        res.json({
            status: 400,
            warnings: `${req.params.fileName} not valid file`,
        })
    }
})

router.get('/delete/:object/:id', async (req, res) => {
    const obj = req.params.object
    const id = req.params.id

    if (obj === 'releaseTestRuns') {
        await Job.deleteMany({ releaseID: id })
    } else if (obj === 'projectTestRuns') {
        const modules = await Module.find({ projectID: id })
        const modulesList = modules?.map((m) => m._id)
        const releases = await Release.find({
            'modules.moduleID': { $in: modulesList },
        })
        const releasesList = releases?.map((r) => r._id)
        const testRuns = await Job.find({ releaseID: { $in: releasesList } })

        await Job.deleteMany({ releaseID: { $in: releasesList } })
        await Release.deleteMany({
            'modules.moduleID': { $in: modulesList },
        })
        await Module.deleteMany({ projectID: id })
        await Project.deleteMany({
            _id: new ObjectId(id.toString()),
        })
    }
    res.json([])
})

router.get('/updated/:status/:id', async (req, res) => {
    const status = req.params.status
    const job = await Job.findById(req.params.id)
    let chdataObj = []
    const { testRun } = job

    const modules = testRun?.map((module) => {
        module.status = status
        const { testNodes } = module

        const newTestNodes = testNodes?.map((testNode) => {
            testNode.status = status
            const { testCaseSteps } = testNode
            const newTestCaseSteps = testCaseSteps?.map((testCaseStep) => {
                testCaseStep.status = status
                return testCaseStep
            })
            testNode.testCaseSteps = newTestCaseSteps
            return testNode
        })

        module.testNodes = newTestNodes

        return module
        // let auditsave = common.UserAudit("64a7b2ea81b8b505b1ddddc9","RELEASE","/updated/"+req.params.id,"UPDATE","SUCCESS","Updated Successfully",req.params.id,chdataObj);
    })

    const newjob = await Job.findByIdAndUpdate(
        req.params.id,
        {
            testRun: modules,
        },
        (err, updatejob) => {
            logger.info('error', err)
        }
    )

    res.json(newjob)
})

router.get('/deleteFiles', async (req, res) => {
    const jobs = await Job.find()
    const jobIds = jobs?.map((job) => job._id)

    let removed = []
    fs.readdir(IMAGES_ROOT_FOLDER, (err, files) => {
        files.forEach((file) => {
            const values = file.split('_')
            if (!jobIds.toString().includes(values[1]?.toString())) {
                removed.push(values[1])
                fs.unlinkSync(IMAGES_ROOT_FOLDER + file)
            }
        })
        fs.readdir(LOGS_ROOT_FOLDER, (err, files) => {
            files.forEach((file) => {
                const values = file.split('_')
                if (!jobIds.toString().includes(values[1]?.toString())) {
                    removed.push(values[1])
                    fs.unlinkSync(LOGS_ROOT_FOLDER + file)
                }
            })
            removed = new Set(removed)
            removed = [...removed]
            res.json({ removed, jobIds })
        })
    })
})

router.post('/v1/SaveRefData', async (req, res) => {
    try {
        let body = req.body
        if (!body.Key) {
            res.send({ status: 204, message: 'Key Required', data: [] })
        } else if (!body.Value) {
            res.send({ status: 204, message: 'Value Required', data: [] })
        } else if (!body.RId) {
            res.send({ status: 204, message: 'Release ID Required', data: [] })
        } else if (!body.JobId) {
            res.send({ status: 204, message: 'Job ID Required', data: [] })
        } else if (!body.MId) {
            res.send({ status: 204, message: 'Module ID Required', data: [] })
        } else {
            const tempkey = await TempVars.find({
                rId: body.RId,
                jobId: body.JobId,
                mId: body.MId,
                key: body.Key,
            })
            //  async (err, tempkey) => {
            if (tempkey.length > 0) {
                //update record with new value
                await TempVars.updateOne(
                    {
                        key: body.Key,
                        rId: body.RId,
                        jobId: body.JobId,
                        mId: body.MId,
                    },
                    {
                        $set: {
                            value: body.Value,
                        },
                    }
                ).then((doc) => {
                    if (doc) {
                        res.send({
                            status: 200,
                            message: 'Key Updated',
                            data: [],
                        })
                    } else {
                        res.send({
                            status: 204,
                            message: 'Something Went Wrong..',
                            data: [],
                        })
                    }
                })
            } else {
                let _savekey = new TempVars({
                    key: body.Key,
                    value: body.Value,
                    rId: body.RId,
                    jobId: body.JobId,
                    mId: body.MId,
                    // createdBy:body.UserId
                })
                await _savekey.save().then(async (doc) => {
                    if (doc) {
                        res.send({
                            status: 200,
                            message: 'Key Saved',
                            data: [],
                        })
                    } else {
                        res.send({
                            status: 400,
                            message: 'Something went wrong',
                            data: [],
                        })
                    }
                })
            }
            //  }
            //  )
        }
    } catch (error) {
        console.log('save ref error', error)
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})
router.post('/v1/GetRefData', async (req, res) => {
    try {
        let body = req.body
        if (!body.Key) {
            res.send({ status: 204, message: 'Key Required', data: [] })
        } else if (!body.RId) {
            res.send({ status: 204, message: 'Release ID Required', data: [] })
        } else if (!body.JobId) {
            res.send({ status: 204, message: 'Job ID Required', data: [] })
        } else if (!body.MId) {
            res.send({ status: 204, message: 'Module ID Required', data: [] })
        } else {
            const tempkey = await TempVars.find(
                {
                    rId: body.RId,
                    jobId: body.JobId,
                    mId: body.MId,
                    key: body.Key,
                },
                { _id: 1, key: 1, value: 1 }
            )
            // TempVars.find(
            //     {
            //         rId: body.RId,
            //         jobId: body.JobId,
            //         mId: body.MId,
            //         key: body.Key,
            //     },
            //     { _id: 1, key: 1, value: 1 },
            //     async (err, tempkey) => {
            if (tempkey.length > 0) {
                res.send({
                    status: 200,
                    message: 'Data Available',
                    data: tempkey,
                })
            } else {
                res.send({
                    status: 204,
                    message: 'Data Not Available',
                    data: [],
                })
            }
        }
        // )
        // }
    } catch (error) {
        console.log('get data ref error', error)
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

router.post('/v1/gettestresultfiles', async (req, res) => {
    // let daa = "";
    let body = req.body
    try {
        if (!body.jobId) {
            res.send({ status: 204, message: 'Job Id Required', data: [] })
        } else if (!body.moduleId) {
            res.send({ status: 204, message: 'Module Id Required', data: [] })
        } else if (!body.testNodeId) {
            res.send({ status: 204, message: 'TestNode Id Required', data: [] })
        } else {
            const { jobId, moduleId, testNodeId, testStepId } = body
            logger.info(
                `Fetching test results files for jobId : ${jobId}, moduleId : ${moduleId} & testNodeId : ${testNodeId}`
            )
            let screenshots
            let logFiles
            const job = await Job.findById(jobId)
            if (job) {
                if (job.testRun.length > 0) {
                    job.testRun.map((module) => {
                        if (module.moduleID === moduleId) {
                            module?.testNodes?.map(async (testNode) => {
                                if (
                                    testNode.testNodeID.toString() ===
                                    testNodeId.toString()
                                ) {
                                    logger.info(
                                        `Looping through test steps to get screenshots and logs`
                                    )
                                    screenshots = await Promise.all(
                                        testNode?.testCaseSteps?.map(
                                            async (testStep) => {
                                                let image = ''
                                                let log = ''
                                                try {
                                                    const screenshotParams = {
                                                        Bucket: process.env
                                                            .AWS_S3_BUCKET,
                                                        Key: testStep?.testStepResultsFile,
                                                    }
                                                    const logFileParams = {
                                                        Bucket: process.env
                                                            .AWS_S3_BUCKET,
                                                        Key: testStep?.testStepLogsFile,
                                                    }
                                                    if (
                                                        testStep?.testStepResultsFile
                                                    ) {
                                                        logger.info(
                                                            `screenshotParams : ${JSON.stringify(screenshotParams)}`
                                                        )
                                                        const stream =
                                                            await s3.send(
                                                                new GetObjectCommand(
                                                                    screenshotParams
                                                                )
                                                            )
                                                        logger.info(
                                                            `Successfully retreived screenshot`
                                                        )
                                                        stream.Body.on(
                                                            'data',
                                                            (data) => {
                                                                image +=
                                                                    Buffer.from(
                                                                        data,
                                                                        'base64'
                                                                    ).toString(
                                                                        'ascii'
                                                                    )
                                                            }
                                                        )
                                                    }
                                                    if (
                                                        testStep?.testStepLogsFile
                                                    ) {
                                                        const stream =
                                                            await s3.send(
                                                                new GetObjectCommand(
                                                                    logFileParams
                                                                )
                                                            )
                                                        stream.Body.on(
                                                            'data',
                                                            (data) => {
                                                                log =
                                                                    Buffer.from(
                                                                        data
                                                                    ).toString()
                                                            }
                                                        )
                                                        // log = Buffer.from(await stream.read()).toString();
                                                    }
                                                } catch (error) {
                                                    logger.info(
                                                        `Error fetching screenshot ${error}`
                                                    )
                                                }
                                                if (image?.length === 0) {
                                                    logger.info(
                                                        `image is empty adding null`
                                                    )
                                                    return null
                                                }
                                                return {
                                                    testStepId: testStep._id,
                                                    testscreenshotfile: [image],
                                                }
                                            }
                                        )
                                    )

                                    logger.info(
                                        `Successfully retreived screenshots..!!`
                                    )

                                    logger.info(
                                        `Looping through test steps to get screenshots and logs`
                                    )

                                    logFiles = await Promise.all(
                                        testNode?.testCaseSteps?.map(
                                            async (testStep) => {
                                                let image = ''
                                                let log = ''
                                                try {
                                                    const screenshotParams = {
                                                        Bucket: process.env
                                                            .AWS_S3_BUCKET,
                                                        Key: testStep?.testStepResultsFile,
                                                    }
                                                    const logFileParams = {
                                                        Bucket: process.env
                                                            .AWS_S3_BUCKET,
                                                        Key: testStep?.testStepLogsFile,
                                                    }

                                                    if (
                                                        testStep?.testStepLogsFile
                                                    ) {
                                                        logger.info(
                                                            `logFileParams : ${JSON.stringify(logFileParams)}`
                                                        )
                                                        const stream =
                                                            await s3.send(
                                                                new GetObjectCommand(
                                                                    logFileParams
                                                                )
                                                            )
                                                        logger.info(
                                                            `Successfully retreived log`
                                                        )
                                                        stream.Body.on(
                                                            'data',
                                                            (data) => {
                                                                log +=
                                                                    Buffer.from(
                                                                        data
                                                                    ).toString()
                                                            }
                                                        )

                                                        if (
                                                            testStep?.testStepResultsFile
                                                        ) {
                                                            const stream =
                                                                await s3.send(
                                                                    new GetObjectCommand(
                                                                        screenshotParams
                                                                    )
                                                                )
                                                            stream.Body.on(
                                                                'data',
                                                                (data) => {
                                                                    image +=
                                                                        Buffer.from(
                                                                            data,
                                                                            'base64'
                                                                        ).toString(
                                                                            'ascii'
                                                                        )
                                                                }
                                                            )
                                                        }
                                                        log = Buffer.from(
                                                            await stream.read()
                                                        ).toString()
                                                    }
                                                } catch (error) {
                                                    logger.info(
                                                        `Error fetching log ${error}`
                                                    )
                                                }

                                                if (log?.length === 0) {
                                                    logger.info(
                                                        `log is empty adding null`
                                                    )
                                                    return null
                                                }

                                                return {
                                                    testStepId: testStep._id,
                                                    testlogfile: [log],
                                                }
                                            }
                                        )
                                    )

                                    logger.info(`Successfully fecthed logs..!!`)

                                    if (screenshots) {
                                        logger.info(
                                            `Sending response with screenshots and logs..!!`
                                        )
                                        res.send({
                                            status: 200,
                                            message: 'Files Available',
                                            data: {
                                                logs: logFiles,
                                                screens: screenshots,
                                            },
                                        })
                                    } else {
                                        logger.info(
                                            `Sending response without screenshots and logs..!!`
                                        )
                                        res.send({
                                            status: 204,
                                            message: 'No Files Available',
                                            data: [],
                                        })
                                    }
                                }
                            })
                        }
                    })
                } else {
                    logger.info(`No Test Runs Available..!!`)
                    res.send({
                        status: 204,
                        message: 'No Test Runs Availabe',
                        data: [],
                    })
                }
            } else {
                logger.info(`No Job Available..!!`)
                res.send({ status: 204, message: 'No Job Available', data: [] })
            }
        }
    } catch (err) {
        logger.info('error in get test result files', err)
    }
})

router.post('/v2/gettestresultfiles', async (req, res) => {
    let body = req.body
    try {
        const { jobId, moduleId, testNodeId, testStepId } = body
        const job = await Job.findById(jobId)
        if (job) {
            if (job.testRun.length > 0) {
                let testruns = job.testRun
                let filesdata = []
                let screenshots = []
                let isloopcompleted = false
                for (let i = 0; i < testruns.length; i++) {
                    if (testruns[i].moduleID === moduleId) {
                        let testcases = []
                        let testnodes = testruns[i].testNodes
                        for (let j = 0; j < testnodes.length; j++) {
                            let isTestNodesCompleted = false
                            if (testnodes.length == j + 1) {
                                isTestNodesCompleted = true
                            }
                            for (
                                let k = 0;
                                k < testnodes[j].testCaseSteps.length;
                                k++
                            ) {
                                const logFileParams = {
                                    Bucket: process.env.AWS_S3_BUCKET,
                                    Key: testnodes[j].testCaseSteps[k]
                                        .testStepLogsFile,
                                }
                                const stream = await s3.send(
                                    new GetObjectCommand(logFileParams)
                                )

                                stream.Body.on('data', (data) => {
                                    filesdata.push({
                                        testStepId:
                                            testnodes[j].testCaseSteps[k]._id,
                                        testlogfile: [
                                            Buffer.from(data).toString(),
                                        ],
                                    })
                                })

                                const screenshotParams = {
                                    Bucket: process.env.AWS_S3_BUCKET,
                                    Key: testnodes[j].testCaseSteps[k]
                                        .testStepResultsFile,
                                }
                                const stream1 = await s3.send(
                                    new GetObjectCommand(screenshotParams)
                                )

                                let screenshot = ''

                                stream1.Body.on('data', (data1) => {
                                    screenshot += Buffer.from(
                                        data1,
                                        'base64'
                                    ).toString('ascii')
                                })

                                if (isTestNodesCompleted) {
                                    if (
                                        testnodes[j].testCaseSteps.length ==
                                        k + 1
                                    ) {
                                        isloopcompleted = true
                                    }
                                }
                            }
                        }
                    }
                }
                if (isloopcompleted) {
                    res.send({
                        status: 200,
                        message: 'Files',
                        data: { logs: filesdata, screens: screenshots },
                    })
                }
            } else {
                res.send({ status: 204, message: 'No Test Runs', data: [] })
            }
        } else {
            res.send({ status: 204, message: 'No Job Available', data: [] })
        }
    } catch (err) {
        logger.info('error in test results file ', err)
    }
})

router.post('/v3/gettestresultfiles', async (req, res) => {
    let body = req.body
    const { jobId, moduleId, testNodeId, testStepId } = body
    const job = await Job.findById(jobId)
    if (job) {
        if (job.testRun.length > 0) {
            let testruns = job.testRun
            let filesdata = []
            let screenshots = []
            let isloopcompleted = false
            let totalsteps = 0
            let finalended = false
            let totaltestcasesteps = 0
            for (let a = 0; a < testruns.length; a++) {
                let testnode = testruns[a].testNodes

                for (let b = 0; b < testnode.length; b++) {
                    if (testnode[b].testNodeID == body.testNodeId) {
                        for (
                            let c = 0;
                            c < testnode[b].testCaseSteps.length;
                            c++
                        ) {
                            totaltestcasesteps += 1
                        }
                    }
                }
            }
            for (let i = 0; i < testruns.length; i++) {
                if (testruns[i].moduleID === moduleId) {
                    let testcases = []
                    let testnodes = testruns[i].testNodes
                    for (let j = 0; j < testnodes.length; j++) {
                        let isTestNodesCompleted = false
                        if (testnodes.length == j + 1) {
                            isTestNodesCompleted = true
                        }
                        if (testnodes[j].testNodeID == body.testNodeId) {
                            for (
                                let k = 0;
                                k < testnodes[j].testCaseSteps.length;
                                k++
                            ) {
                                const logFileParams = {
                                    Bucket: process.env.AWS_S3_BUCKET,
                                    Key: testnodes[j].testCaseSteps[k]
                                        .testStepLogsFile,
                                }
                                const stream = await s3.send(
                                    new GetObjectCommand(logFileParams)
                                )
                                stream.Body.on('data', (data) => {
                                    filesdata.push({
                                        testStepId:
                                            testnodes[j].testCaseSteps[k]._id,
                                        testlogfile: [
                                            Buffer.from(data).toString(),
                                        ],
                                    })
                                })
                                const screenshotParams = {
                                    Bucket: process.env.AWS_S3_BUCKET,
                                    Key: testnodes[j].testCaseSteps[k]
                                        .testStepResultsFile,
                                }
                                const stream1 = await s3.send(
                                    new GetObjectCommand(screenshotParams)
                                )
                                stream1.Body.on('data', (data1) => {
                                    screenshots.push({
                                        testStepId:
                                            testnodes[j].testCaseSteps[k]._id,
                                        testscreenshotfile: Buffer.from(
                                            data1,
                                            'base64'
                                        ).toString('ascii'),
                                    })
                                })
                                stream1.Body.on('end', (data1) => {
                                    totalsteps += 1
                                    if (totalsteps == totaltestcasesteps) {
                                        finalended = true
                                        let concdata = []
                                        let testDataMap = {}
                                        screenshots.forEach((screen) => {
                                            if (
                                                testDataMap.hasOwnProperty(
                                                    screen.testStepId
                                                )
                                            ) {
                                                testDataMap[
                                                    screen.testStepId
                                                ].push(
                                                    screen.testscreenshotfile
                                                )
                                            } else {
                                                testDataMap[screen.testStepId] =
                                                    [screen.testscreenshotfile]
                                            }
                                        })
                                        for (let testStepId in testDataMap) {
                                            if (
                                                testDataMap.hasOwnProperty(
                                                    testStepId
                                                )
                                            ) {
                                                concdata.push({
                                                    testStepId: testStepId,
                                                    testscreenshotfile: [
                                                        testDataMap[
                                                            testStepId
                                                        ].join(''),
                                                    ],
                                                })
                                            }
                                        }
                                        res.send({
                                            status: 200,
                                            message: 'Files',
                                            data: {
                                                logs: filesdata,
                                                screens: concdata,
                                            },
                                        })
                                    }
                                })
                            }
                        }
                    }
                }
            }
        } else {
            res.send({ status: 204, message: 'No Test Runs', data: [] })
        }
    } else {
        res.send({ status: 204, message: 'No Job Available', data: [] })
    }
})

const getObjectFromS3 = async (params) => {
    const response = await s3.send(new GetObjectCommand(params))
    logger.info(`Successfully retreived object : ${JSON.stringify(params)}`)
    const streamToString = async (stream) => {
        return new Promise((resolve, reject) => {
            const chunks = []
            stream.on('data', (chunk) => chunks.push(chunk))
            stream.on('end', () =>
                resolve(Buffer.concat(chunks).toString('utf-8'))
            )
            stream.on('error', reject)
        })
    }
    return await streamToString(response.Body)
}

router.post('/v4/gettestresultfiles', async (req, res) => {
    // let daa = "";
    let body = req.body
    console.log('body', body)
    try {
        if (!body.jobId) {
            res.send({ status: 204, message: 'Job Id Required', data: [] })
        } else if (!body.moduleId) {
            res.send({ status: 204, message: 'Module Id Required', data: [] })
        } else if (!body.testNodeId) {
            res.send({ status: 204, message: 'TestNode Id Required', data: [] })
        } else {
            const { jobId, moduleId, testNodeId, testStepId } = body
            logger.info(
                `Fetching test results files for jobId : ${jobId}, moduleId : ${moduleId} & testNodeId : ${testNodeId}`
            )
            let logFiles
            let testCaseScreenshot = []
            const job = await Job.findById(jobId)
            if (job) {
                if (job.testRun.length > 0) {
                    job.testRun.map((module) => {
                        if (module.moduleID === moduleId) {
                            module?.testNodes?.map(async (testNode) => {
                                if (
                                    testNode.testNodeID.toString() ===
                                    testNodeId.toString()
                                ) {
                                    logger.info(
                                        `Looping through test case to get screenshot`
                                    )
                                    // Test Case screenshot
                                    if (testNode?.testCaseResultsFile) {
                                        try {
                                            let image = ''

                                            if (process.env.AWS_S3_BUCKET) {
                                                const screenshotParams = {
                                                    Bucket: process.env
                                                        .AWS_S3_BUCKET,
                                                    Key: testNode.testCaseResultsFile,
                                                }
                                                logger.info(
                                                    `screenshotParams (testNode): ${JSON.stringify(screenshotParams)}`
                                                )
                                                image =
                                                    await getObjectFromS3(
                                                        screenshotParams
                                                    )
                                            } else if (sharedStorage) {
                                                const remoteFilePath =
                                                    path.join(
                                                        testNode.testCaseResultsFile
                                                    )
                                                logger.info(
                                                    `screenshotParams (testNode): ${remoteFilePath}`
                                                )
                                                image =
                                                    await responseTransformer.readFileFromSMBPath(
                                                        null,
                                                        remoteFilePath
                                                    )
                                            } else if (mountStorage) {
                                                const remoteFilePath =
                                                    path.join(
                                                        testNode.testCaseResultsFile
                                                    )
                                                logger.info(
                                                    `screenshotParams (testNode): ${remoteFilePath}`
                                                )
                                                image =
                                                    await getScreenshotFromMountLocation(
                                                        remoteFilePath
                                                    )
                                            }
                                            if (image && image.length > 0) {
                                                testCaseScreenshot.push({
                                                    testStepId:
                                                        testNode.testNodeID,
                                                    testscreenshotfile: [image],
                                                })
                                            } else {
                                                logger.info(
                                                    `testNode image is empty, adding null`
                                                )
                                                testCaseScreenshot.push(null)
                                            }
                                        } catch (error) {
                                            logger.info(
                                                `Error fetching testNode screenshot: ${error}`
                                            )
                                            testCaseScreenshot.push(null)
                                        }
                                    }
                                    logger.info(
                                        `Looping through test steps to get screenshots and logs`
                                    )
                                    // Test Case Step screenshots
                                    const screenshots = await Promise.all(
                                        testNode?.testCaseSteps?.map(
                                            async (testStep) => {
                                                let image = ''
                                                try {
                                                    if (
                                                        process.env
                                                            .AWS_S3_BUCKET
                                                    ) {
                                                        const screenshotParams =
                                                            {
                                                                Bucket: process
                                                                    .env
                                                                    .AWS_S3_BUCKET,
                                                                Key: testStep?.testStepResultsFile,
                                                            }

                                                        if (
                                                            testStep?.testStepResultsFile
                                                        ) {
                                                            logger.info(
                                                                `screenshotParams : ${JSON.stringify(screenshotParams)}`
                                                            )

                                                            image =
                                                                await getObjectFromS3(
                                                                    screenshotParams
                                                                ) // Assuming this returns string
                                                        }
                                                    } else if (sharedStorage) {
                                                        if (
                                                            testStep?.testStepResultsFile
                                                        ) {
                                                            logger.info(
                                                                `screenshotParams : ${testStep?.testStepResultsFile}`
                                                            )

                                                            const remoteFilePath =
                                                                path.join(
                                                                    testStep.testStepResultsFile
                                                                )

                                                            image =
                                                                await responseTransformer.readFileFromSMBPath(
                                                                    null,
                                                                    remoteFilePath
                                                                )
                                                        }
                                                    } else if (mountStorage) {
                                                        if (
                                                            testStep?.testStepResultsFile
                                                        ) {
                                                            logger.info(
                                                                `screenshotParams : ${testStep?.testStepResultsFile}`
                                                            )

                                                            const remoteFilePath =
                                                                path.join(
                                                                    testStep.testStepResultsFile
                                                                )

                                                            image =
                                                                await getScreenshotFromMountLocation(
                                                                    remoteFilePath
                                                                )
                                                        }
                                                    }
                                                } catch (error) {
                                                    logger.info(
                                                        `Error fetching screenshot: ${error}`
                                                    )
                                                }

                                                if (
                                                    !image ||
                                                    image.length === 0
                                                ) {
                                                    logger.info(
                                                        `image is empty, adding null`
                                                    )
                                                    return null
                                                }

                                                return {
                                                    testStepId: testStep._id,
                                                    testscreenshotfile: [image],
                                                }
                                            }
                                        )
                                    )
                                    // Including test case screenshot also in the test case step screenshots
                                    screenshots.push(...testCaseScreenshot)
                                    logger.info(
                                        `Successfully retreived screenshots..!!`
                                    )

                                    logger.info(
                                        `Looping through test steps to get screenshots and logs`
                                    )

                                    logFiles = await Promise.all(
                                        testNode?.testCaseSteps?.map(
                                            async (testStep) => {
                                                let log = ''
                                                try {
                                                    if (
                                                        process.env
                                                            .AWS_S3_BUCKET
                                                    ) {
                                                        const logFileParams = {
                                                            Bucket: process.env
                                                                .AWS_S3_BUCKET,
                                                            Key: testStep?.testStepLogsFile,
                                                        }

                                                        if (
                                                            testStep?.testStepLogsFile
                                                        ) {
                                                            logger.info(
                                                                `logFileParams : ${JSON.stringify(logFileParams)}`
                                                            )

                                                            log =
                                                                await getObjectFromS3(
                                                                    logFileParams
                                                                )
                                                        }
                                                    } else if (sharedStorage) {
                                                        if (
                                                            testStep?.testStepLogsFile
                                                        ) {
                                                            logger.info(
                                                                `screenshotParams : ${testStep?.testStepLogsFile}`
                                                            )

                                                            const remoteFilePath =
                                                                path.join(
                                                                    testStep?.testStepLogsFile
                                                                )

                                                            log =
                                                                await responseTransformer.readFileFromSMBPath(
                                                                    null,
                                                                    remoteFilePath
                                                                )
                                                        }
                                                    } else if (mountStorage) {
                                                        if (
                                                            testStep?.testStepLogsFile
                                                        ) {
                                                            logger.info(
                                                                `screenshotParams : ${testStep?.testStepLogsFile}`
                                                            )

                                                            const remoteFilePath =
                                                                path.join(
                                                                    mountStorage,
                                                                    testStep.testStepLogsFile
                                                                )

                                                            log =
                                                                fs.readFileSync(
                                                                    remoteFilePath,
                                                                    {
                                                                        flag: 'r',
                                                                        encoding:
                                                                            'utf8',
                                                                    }
                                                                )
                                                        }
                                                    }
                                                } catch (error) {
                                                    logger.info(
                                                        `Error fetching log ${error}`
                                                    )
                                                }

                                                if (log?.length === 0) {
                                                    logger.info(
                                                        `log is empty adding null`
                                                    )
                                                    return null
                                                }

                                                return {
                                                    testStepId: testStep._id,
                                                    testlogfile: [log],
                                                }
                                            }
                                        )
                                    )

                                    logger.info(`Successfully fecthed logs..!!`)

                                    if (screenshots) {
                                        logger.info(
                                            `Sending response with screenshots and logs..!!`
                                        )
                                        try {
                                            res.send({
                                                status: 200,
                                                message: 'Files Available',
                                                data: {
                                                    logs: logFiles,
                                                    screens: screenshots,
                                                },
                                            })
                                        } catch (error) {
                                            logger.info(
                                                `Encountered issue while fetching details ${error}`
                                            )
                                        }
                                    } else {
                                        logger.info(
                                            `Sending response without screenshots and logs..!!`
                                        )
                                        res.send({
                                            status: 204,
                                            message: 'No Files Available',
                                            data: [],
                                        })
                                    }
                                }
                            })
                        }
                    })
                } else {
                    logger.info(`No Test Runs Available..!!`)
                    res.send({
                        status: 204,
                        message: 'No Test Runs Availabe',
                        data: [],
                    })
                }
            } else {
                logger.info(`No Job Available..!!`)
                res.send({ status: 204, message: 'No Job Available', data: [] })
            }
        }
    } catch (err) {
        logger.info('error in get test result files', err)
    }
})

const fetchFile = async (filePath, returnType = 'buffer') => {
    try {
        if (!filePath) return null
        let fileContent = null

        if (process.env.AWS_S3_BUCKET) {
            const params = {
                Bucket: process.env.AWS_S3_BUCKET,
                Key: filePath,
            }
            // logger.info(`Fetching from S3: ${JSON.stringify(params)}`)
            // const data = await s3.getObject(params).promise()
            const command = new GetObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: filePath,
            })

            const response = await s3.send(command)
            const body = await response.Body.transformToString()
            // console.log('File content:', body)
            fileContent = body
        } else if (sharedStorage) {
            const remoteFilePath = path.join(filePath)
            logger.info(`Fetching from SMB: ${remoteFilePath}`)
            fileContent = await readFileFromSMBPath(null, filePath)
        } else if (mountStorage) {
            const remoteFilePath = path.join(filePath)
            logger.info(`Fetching from MOUNT: ${filePath}`)
            fileContent = await getScreenshotFromMountLocation(filePath)
        }

        // Fallback if fileContent is base64 string (e.g., data URI)
        if (
            typeof fileContent === 'string' &&
            fileContent.startsWith('data:')
        ) {
            const base64Data = fileContent
                .replace(/^data:image\/\w+;base64,/, '')
                .replace(/^data:\/png;base64,/, '') // malformed fix
            fileContent = Buffer.from(base64Data, 'base64')
        }

        if (!fileContent) return null

        if (returnType === 'text') {
            if (Buffer.isBuffer(fileContent)) {
                return fileContent.toString('utf8')
            }
            return fileContent // already string
        }

        if (returnType === 'buffer') {
            return Buffer.isBuffer(fileContent)
                ? fileContent
                : Buffer.from(fileContent)
        }

        return null
    } catch (err) {
        logger.error('fetchFile error:', err)
        return null
    }
}

// Utility: Create thumbnail from image buffer
const getThumbnailBase64Image = async (buffer, width = 150, height = 90) => {
    try {
        if (!buffer) return null

        const resizedBuffer = await sharp(buffer)
            .resize(width, height, { fit: 'cover' })
            .png()
            .toBuffer()

        return `data:image/png;base64,${resizedBuffer.toString('base64')}`
    } catch (err) {
        logger.error('Thumbnail generation error:', err)
        return null
    }
}

router.post('/v5/gettestresultfiles', async (req, res) => {
    const { jobId, moduleId, testNodeId, testStepId, fileType } = req.body

    if (!jobId || !moduleId || !testNodeId) {
        return res.status(400).json({
            status: 400,
            message: 'Missing required fields: jobId, moduleId, or testNodeId',
            data: [],
        })
    }

    try {
        const job = await Job.findById(jobId)
        if (!job) {
            return res.status(404).json({
                status: 404,
                message: 'Job not found',
                data: [],
            })
        }

        const module = job.testRun.find((m) => m.moduleID === moduleId)
        if (!module) {
            return res.status(404).json({
                status: 404,
                message: 'Module not found',
                data: [],
            })
        }

        const testNode = module.testNodes.find(
            (tn) => tn.testNodeID.toString() === testNodeId.toString()
        )
        console.log('testNode', testNode)
        if (!testNode) {
            return res.status(404).json({
                status: 404,
                message: 'Test Node not found',
                data: [],
            })
        }

        const result = {}

        // Logs
        if (!fileType || fileType === 'logs') {
            const logs = []

            for (const step of testNode.testCaseSteps || []) {
                if (testStepId && step._id.toString() !== testStepId) continue

                if (step.testStepLogsFile) {
                    const logContent = await fetchFile(
                        step.testStepLogsFile,
                        'text'
                    )
                    logs.push({
                        testStepId: step._id,
                        testlogfile: logContent ? [logContent] : [],
                    })
                }
            }

            if (logs.length > 0) {
                result.logs = logs
            }
        }

        // Screenshots as thumbnails
        if (!fileType || fileType === 'screenshot') {
            const screenshots = []

            for (const step of testNode.testCaseSteps || []) {
                if (testStepId && step._id.toString() !== testStepId) continue

                if (step.testStepResultsFile) {
                    const buffer = await fetchFile(
                        step.testStepResultsFile,
                        'buffer'
                    )
                    const thumbnail = await getThumbnailBase64Image(buffer)
                    if (thumbnail) {
                        screenshots.push({
                            testStepId: step._id,
                            testscreenshotfile: [thumbnail],
                        })
                    }
                }
            }

            // Include testNode-level screenshot if no specific testStepId requested
            if (!testStepId && testNode.testCaseResultsFile) {
                const buffer = await fetchFile(
                    testNode.testCaseResultsFile,
                    'buffer'
                )
                const thumbnail = await getThumbnailBase64Image(buffer)
                if (thumbnail) {
                    screenshots.push({
                        testStepId: testNode.testNodeID,
                        testscreenshotfile: [thumbnail],
                    })
                }
            }

            if (screenshots.length > 0) {
                result.screens = screenshots
            }
        }

        // No files found
        if (!result.logs && !result.screenshots) {
            return res.status(204).json({
                status: 204,
                message: 'No matching files found',
                data: [],
            })
        }

        // Success response
        return res.status(200).json({
            status: 200,
            message: 'Files Available',
            data: result,
        })
    } catch (err) {
        logger.error('Unexpected error in gettestresultfiles:', err)
        return res.status(500).json({
            status: 500,
            message: 'Internal Server Error',
            data: [],
        })
    }
})

router.post('/V1/getTestresultfile', async (req, res) => {
    const { jobId, moduleId, testNodeId, testStepId } = req.body

    if (!jobId || !moduleId || !testNodeId || !testStepId) {
        return res.status(400).json({
            status: 400,
            message:
                'Missing required fields: jobId, moduleId, testNodeId, or testStepId',
            data: [],
        })
    }

    try {
        const job = await Job.findById(jobId)
        if (!job) {
            return res.status(404).json({
                status: 404,
                message: 'Job not found',
                data: [],
            })
        }

        const module = job.testRun.find((m) => m.moduleID === moduleId)
        if (!module) {
            return res.status(404).json({
                status: 404,
                message: 'Module not found',
                data: [],
            })
        }

        const testNode = module.testNodes.find(
            (tn) => tn.testNodeID.toString() === testNodeId.toString()
        )
        if (!testNode) {
            return res.status(404).json({
                status: 404,
                message: 'Test Node not found',
                data: [],
            })
        }

        const step = (testNode.testCaseSteps || []).find(
            (s) => s._id.toString() === testStepId.toString()
        )
        console.log('step', step)
        if (!step || !step.testStepResultsFile) {
            return res.status(204).json({
                status: 204,
                message: 'No screenshot found for the given testStepId',
                data: [],
            })
        }

        const buffer = await fetchFile(step.testStepResultsFile, 'buffer')
        if (!buffer) {
            return res.status(204).json({
                status: 204,
                message: 'Screenshot file could not be loaded',
                data: [],
            })
        }

        const base64Image = `data:image/png;base64,${buffer.toString('base64')}`

        return res.status(200).json({
            status: 200,
            message: 'Screenshot retrieved successfully',
            data: {
                testStepId,
                screenshot: base64Image,
            },
        })
    } catch (err) {
        logger.error('Error fetching screenshot:', err)
        return res.status(500).json({
            status: 500,
            message: 'Internal server error',
            data: [],
        })
    }
})

async function readSmbFile(remoteFilePath) {
    try {
        // If the file contains text (e.g., base64 string)
        const content = await smb.readFile(remoteFilePath, 'utf8')
        console.log('SMB file content:', content)
        return content
    } catch (err) {
        console.error('Failed to read SMB file:', err)
        throw err
    }
}

router.post('/v1/emailsummary', async (req, res) => {
    let body = req.body
    if (!body.jobId) {
        res.send({ status: 204, message: 'JobId Required', data: [] })
    } else {
        const job = await Job.findById(body.jobId)
        const user = await User.findById(job?.createdBy)
        const release = await Release.findById(job?.releaseID)
        const relJobs = await Job.find({
            releaseID: job?.releaseID,
            version: release?.testRunVersion,
        })
        let untested = 0
        let passed = 0
        let skipped = 0
        let failed = 0
        let blocked = 0
        let total = 0
        let relUntested = 0
        let relPassed = 0
        let relSkipped = 0
        let relFailed = 0
        let relBlocked = 0
        let percentage = 0

        const jobs = []
        if (relJobs) {
            relJobs?.forEach((job) => {
                const { testRun } = job
                testRun?.forEach((module) => {
                    const { testNodes } = module
                    untested = testNodes?.filter(
                        (testNode) => testNode?.status === JobStatus.UNTESTED
                    )?.length
                    passed = testNodes?.filter(
                        (testNode) => testNode?.status === JobStatus.PASSED
                    )?.length
                    skipped = testNodes?.filter(
                        (testNode) => testNode?.status === JobStatus.SKIPPED
                    )?.length
                    failed = testNodes?.filter(
                        (testNode) => testNode?.status === JobStatus.FAILED
                    )?.length
                    blocked = testNodes?.filter(
                        (testNode) => testNode?.status === JobStatus.BLOCKED
                    )?.length
                    relUntested += untested
                    relPassed += passed
                    relSkipped += skipped
                    relFailed += failed
                    relBlocked += blocked
                    total = untested + passed + skipped + failed + blocked
                    const date = new Date(parseInt(job?.executionDuration, 10))
                    const formattedDuration =
                        parseInt(date.getMinutes(), 10) !== 0
                            ? moment(date).format('m[m] s[s]')
                            : moment(date).format('s[s]')
                    const newJob = {}
                    newJob._id = job._id
                    newJob.runNo = `${release?.releaseName}_${job.jenkinsJobID}`
                    newJob.release = `${release?.releaseName}`
                    newJob.total = total
                    newJob.untested = untested
                    newJob.passed = passed
                    newJob.skipped = skipped
                    newJob.failed = failed
                    newJob.blocked = blocked
                    newJob.executionDuration = formattedDuration
                    jobs.push(newJob)
                })
            })
        }
        total = relUntested + relPassed + relSkipped + relFailed + relBlocked
        percentage = automatedPercentage = parseFloat((relPassed / total) * 100)
            .toFixed(2)
            .replace('.00', '')

        const relDuration = await getReleaseExecutionDuration(
            release,
            release?.testRunVersion
        )

        const relSummary = {
            ReleaseId: release?._id,
            ReleaseName: release?.releaseName,
            completed_perc: percentage,
            completed_time: relDuration,
            total,
            Passed: relPassed,
            Failed: relFailed,
            Untested: relUntested,
            Blocked: relBlocked,
            Skipped: relSkipped,
        }
        const summary = {
            relSummary,
            testRuns: jobs,
        }
        if (release) {
            let email = await common
                .sendPieChartEmail(
                    user.email,
                    release?.releaseName + ' - Summary Report',
                    summary,
                    `${user?.firstName} ${user?.lastName}`,
                    'SUMMARY_REPORT',
                    job._id,
                    body?.attachments
                )
                .catch(console.error)
            res.send({
                status: 200,
                message: `Sent email to ${user.email}`,
                data: summary,
            })
        } else {
            res.send({ status: 200, message: 'Release not found', data: '' })
        }
    }
})

router.post('/v1/sendAttachmentInEmail', async (req, res) => {
    try {
        const response = await common.sendAttachmentEmail(req.body)
        res.send({
            status: 200,
            message: `Sent email to ${req.body.to}`,
            data: response,
        })
    } catch (error) {
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

//User Details
router.post('/v1/getReleaseTestRunVersion', async (req, res) => {
    try {
        const body = req.body
        const release = await Release.findById(body.releaseId)
        let version = 0.01
        if (release?.testRunVersion) version = release?.testRunVersion + 0.01
        version = version.toFixed(2)

        // Release.findByIdAndUpdate(
        //     body.releaseId,
        //     {
        //         testRunVersion: version,
        //     },
        //     (err, release) => {
        //         if (err) console.error('err', err)
        //     }
        // )
        const updatedRelease = await Release.findByIdAndUpdate(
            body.releaseId,
            { testRunVersion: version },
            { new: true } // to return the updated document
        )
        res.send({
            status: 200,
            message: { data: { version } },
        })
    } catch (error) {
        logger.info(
            `Encountered issue while fetching release test run version ${error}`
        )
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

router.post('/v1/getReleaseExecutionDuration', async (req, res) => {
    try {
        const body = req.body
        const release = await Release.findById(body.releaseId)
        let formattedTimeDifference = null
        let queryParams = {
            releaseID: release?._id,
            version: release?.testRunVersion,
        }
        if (body.moduleId) {
            queryParams = {
                releaseID: release?._id,
                version: release?.testRunVersion,
                'testRun.moduleID': body?.moduleId,
            }
        }
        if (release?.testRunVersion) {
            const jobs = await Job.find({
                releaseID: release?._id,
                version: release?.testRunVersion,
            })
            const jobStarts = Array.from(
                new Set(jobs.map((u) => new Date(u.executionStart)))
            )

            const jobEnds = Array.from(
                new Set(jobs.map((u) => new Date(u.executionEnd)))
            )

            const validStartDates = []

            for (const date of jobStarts) {
                const newDate = new Date(date)

                if (newDate.toString() !== 'Invalid Date') {
                    validStartDates.push(newDate)
                }
            }

            const validEndDates = []

            for (const date of jobEnds) {
                const newDate = new Date(date)

                if (newDate.toString() !== 'Invalid Date') {
                    validEndDates.push(newDate)
                }
            }

            const starttime = Math.max(...validEndDates)
            const endtime = Math.min(...validStartDates)

            if (validEndDates?.length && validStartDates?.length) {
                let timeDiffInMilliseconds = starttime - endtime

                let timeDiffInSeconds = Math.abs(timeDiffInMilliseconds) / 1000

                let minutes = Math.floor(timeDiffInSeconds / 60)
                let seconds = Math.floor(timeDiffInSeconds % 60)

                formattedTimeDifference = `${minutes !== 0 ? `${minutes}m` : ''} ${seconds}s`
            }
        }

        res.send({
            status: 200,
            message: { data: { executionDuration: formattedTimeDifference } },
        })
    } catch (error) {
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

router.post('/v1/getGenAITestCases', async (req, res) => {
    try {
        const url = process.env.GEN_AI_TESTCASES_HOST
        const body = req.body

        let formData = { inputText: body.inputText, inputImage: null }

        if (body?.input === GEN_AI_INPUT.IMAGE)
            formData = { inputText: null, inputImage: body.inputText }

        await axios
            .post(url, formData, {})
            .then((resp) => {
                res.send({
                    status: 200,
                    data: resp.data,
                })
            })
            .catch((err) => {
                res.status(400).json({ message: err?.message })
            })
    } catch (error) {
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

router.post('/v1/uploadVideo', async (req, res) => {
    try {
        const { jobId, moduleId, moduleName, status } = req.body
        const videoPath = path.join(
            'videos',
            jobId,
            moduleId,
            `${moduleName}.mp4`
        )
        if (req.files?.video_file && sharedStorage) {
            const videoPath = path.join('videos', jobId, moduleId)
            await uploadVideoFileToSharedFolder(
                req.files.video_file.data,
                videoPath,
                `${moduleName}.mp4`
            )
        } else if (req.files?.video_file && mountStorage) {
            const videoPath = path.join('videos', jobId, moduleId)
            await uploadVideoFileToMountFolder(
                req.files.video_file.data,
                videoPath,
                `${moduleName}.mp4`
            )
            logger.info(
                'mount sorage A new text file was created successfully.'
            )
        } else if (req.files?.video_file)
            await uploadVideoFileToS3(req.files.video_file.data, videoPath)

        // Job.findById(jobId, (err, job) => {
        //     responseTransformer.passthroughError(
        //         err,
        //         job,
        //         'find job',
        //         res,
        //         (job) => {
        //             job['linuxScreenRecord']['video'] = videoPath
        //             job['linuxScreenRecord']['status'] = status
        //             Job.findByIdAndUpdate(jobId, job, (err, resJob) => {})
        //         }
        //     )
        // })
        let job = await Job.findById(jobId)

        if (!job) {
            return res.status(404).send('Job not found')
        }

        job.linuxScreenRecord.video = videoPath
        job.linuxScreenRecord.status = status
        logger.info(`Update job ${job}`)

        await Job.findByIdAndUpdate(jobId, job, { new: true })
        logger.info('Job updated successfully')
        res.send({ status: 200, data: 'Video upload success' })
    } catch (error) {
        console.log('error', error)
        res.send({ status: 400, message: 'Bad Request', data: error })
    }
})

const streamToString = async (stream) => {
    const chunks = []
    for await (const chunk of stream) {
        chunks.push(chunk)
    }
    return Buffer.concat(chunks).toString('utf-8')
}

router.get('/v1/video/stream/:userId/:testRunId', async (req, res) => {
    try {
        const { userId, testRunId } = req.params
        if (!userId) {
            res.send({ status: 204, message: 'User Id Required', data: '' })
        } else {
            User.findById(userId).then(async (user, err) => {
                if (user) {
                    Job.findById(testRunId).then(async (job, err) => {
                        if (job) {
                            const project = await Project.findById(
                                job.projectID,
                                { team: 1 }
                            )
                            const userHasAccess = project.team.includes(userId)

                            if (!userHasAccess) {
                                res.send({
                                    status: 400,
                                    message:
                                        'User has no access to this Video!!',
                                    data: '',
                                })
                            } else if (
                                user._id &&
                                userHasAccess &&
                                job?.linuxScreenRecord?.video
                            ) {
                                try {
                                    if (process.env.AWS_S3_BUCKET) {
                                        const params = {
                                            Bucket: process.env.AWS_S3_BUCKET,
                                            Key: job?.linuxScreenRecord?.video,
                                            // Expires: 300, // 5 minutes
                                        }

                                        const metadata = await s3.send(
                                            new GetObjectCommand(params)
                                        )
                                        const fileSize = metadata.ContentLength

                                        const range = req.headers.range

                                        if (!range) {
                                            res.status(400).send(
                                                'Requires Range header'
                                            )
                                            return
                                        }

                                        // 2️⃣ Parse Range Header
                                        const CHUNK_SIZE = 10 ** 6 // 1MB chunks
                                        const start = Number(
                                            range.replace(/\D/g, '')
                                        )
                                        const end = Math.min(
                                            start + CHUNK_SIZE,
                                            fileSize - 1
                                        )
                                        const contentLength = end - start + 1

                                        // 3️⃣ Get Video Stream from S3/MinIO
                                        const getObjectParams = {
                                            Bucket: process.env.AWS_S3_BUCKET,
                                            Key: job?.linuxScreenRecord?.video,
                                            Range: `bytes=${start}-${end}`,
                                        }

                                        const { Body } = await s3.send(
                                            new GetObjectCommand(
                                                getObjectParams
                                            )
                                        )

                                        // 4️⃣ Set Headers and Stream Data
                                        res.writeHead(206, {
                                            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                                            'Accept-Ranges': 'bytes',
                                            'Content-Length': contentLength,
                                            'Content-Type': 'video/mp4',
                                        })

                                        Body.pipe(res)
                                    } else if (mountStorage) {
                                        const filePath =
                                            job?.linuxScreenRecord?.video
                                        const mountFolderPath = path.join(
                                            mountStorage,
                                            filePath
                                        )
                                        const videoPath = mountFolderPath

                                        // Get file stats
                                        const stat = fs.statSync(videoPath)
                                        const fileSize = stat.size
                                        const range = req.headers.range

                                        if (!range) {
                                            res.status(400).send(
                                                'Requires Range header'
                                            )
                                            return
                                        }

                                        // Parse Range header
                                        const CHUNK_SIZE = 10 ** 6 // 1MB per chunk
                                        const start = Number(
                                            range.replace(/\D/g, '')
                                        )
                                        const end = Math.min(
                                            start + CHUNK_SIZE,
                                            fileSize - 1
                                        )

                                        const contentLength = end - start + 1

                                        // Create file stream
                                        const fileStream = fs.createReadStream(
                                            videoPath,
                                            { start, end }
                                        )

                                        // Set headers
                                        res.writeHead(206, {
                                            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                                            'Accept-Ranges': 'bytes',
                                            'Content-Length': contentLength,
                                            'Content-Type': 'video/mp4',
                                        })

                                        // Pipe video stream
                                        fileStream.pipe(res)
                                    }
                                } catch (error) {
                                    res.send({
                                        status: 400,
                                        message: 'No Video found!!',
                                        data: '',
                                    })
                                }
                            } else {
                                res.send({
                                    status: 400,
                                    message: 'No Video found!!',
                                    data: '',
                                })
                            }
                        } else {
                            res.send({
                                status: 400,
                                message: 'No Job found!!',
                                data: '',
                            })
                        }
                    })
                } else {
                    res.send({
                        status: 400,
                        message: 'Bad Request',
                        data: 'User not found!!',
                    })
                }
            })
            // res.send({ status: 200, data: { presignedUrl } })
        }
    } catch (error) {
        console.error('Error streaming video', error)
        res.status(500).json({ error: 'Failed to stream video' })
    }
})

router.get('/v1/video/download/:userId/:testRunId', async (req, res) => {
    try {
        const { userId, testRunId } = req.params
        if (!userId) {
            res.send({ status: 204, message: 'User Id Required', data: '' })
        } else {
            User.findById(userId).then(async (user, err) => {
                if (user) {
                    Job.findById(testRunId).then(async (job, err) => {
                        if (job) {
                            const project = await Project.findById(
                                job.projectID,
                                { team: 1 }
                            )
                            const userHasAccess = project.team.includes(userId)

                            if (!userHasAccess) {
                                res.send({
                                    status: 400,
                                    message:
                                        'User has no access to this Video!!',
                                    data: '',
                                })
                            } else if (
                                user._id &&
                                userHasAccess &&
                                job?.linuxScreenRecord?.video
                            ) {
                                try {
                                    if (process.env.AWS_S3_BUCKET) {
                                        // 🔹 Generate a presigned URL (recommended for big files)
                                        const command = new GetObjectCommand({
                                            Bucket: process.env.AWS_S3_BUCKET,
                                            Key: job?.linuxScreenRecord?.video,
                                        })

                                        // expiresIn = seconds (e.g., 300 = 5 minutes)
                                        const url = await getSignedUrl(
                                            s3,
                                            command,
                                            { expiresIn: 300 }
                                        )

                                        res.redirect(url) // Let browser handle download from S3 directly
                                    } else if (mountStorage) {
                                        const filePath =
                                            job?.linuxScreenRecord?.video
                                        const videoPath = path.join(
                                            mountStorage,
                                            filePath
                                        )

                                        res.download(videoPath, 'video.mp4') // forces browser download
                                    }
                                } catch (error) {
                                    res.send({
                                        status: 400,
                                        message: 'No Video found!!',
                                        data: '',
                                    })
                                }
                            } else {
                                res.send({
                                    status: 400,
                                    message: 'No Video found!!',
                                    data: '',
                                })
                            }
                        } else {
                            res.send({
                                status: 400,
                                message: 'No Job found!!',
                                data: '',
                            })
                        }
                    })
                } else {
                    res.send({
                        status: 400,
                        message: 'Bad Request',
                        data: 'User not found!!',
                    })
                }
            })
            // res.send({ status: 200, data: { presignedUrl } })
        }
    } catch (error) {
        console.error('Error streaming video', error)
        res.status(500).json({ error: 'Failed to stream video' })
    }
})

router.get('/v1/exportedFile/download/:userId/:testRunId', async (req, res) => {
    try {
        const { userId, testRunId } = req.params
        if (!userId) {
            res.send({ status: 204, message: 'User Id Required', data: '' })
        } else {
            User.findById(userId).then(async (user, err) => {
                if (user) {
                    Job.findById(testRunId).then(async (job, err) => {
                        if (job) {
                            const project = await Project.findById(
                                job.projectID,
                                { team: 1 }
                            )
                            const userHasAccess = project.team.includes(userId)

                            if (!userHasAccess) {
                                res.send({
                                    status: 400,
                                    message:
                                        'User has no access to this Video!!',
                                    data: '',
                                })
                            } else if (
                                user._id &&
                                userHasAccess &&
                                job?.exportedFilePath
                            ) {
                                try {
                                    if (process.env.AWS_S3_BUCKET) {
                                        // 🔹 Generate S3 get command
                                        const command = new GetObjectCommand({
                                            Bucket: process.env.AWS_S3_BUCKET,
                                            Key: job?.exportedFilePath, // example: 'exportedFiles/jobId/moduleId/TestCases.xlsx'
                                        })

                                        // 🔹 Fetch the file from MinIO
                                        const response = await s3.send(command)

                                        // 🔹 Ensure downloads folder exists
                                        const downloadDir = path.join(
                                            __dirname,
                                            job?._id?.toString()
                                        )
                                        if (!fs.existsSync(downloadDir)) {
                                            fs.mkdirSync(downloadDir, {
                                                recursive: true,
                                            })
                                        }

                                        const fileName = path.basename(
                                            job?.exportedFilePath
                                        )

                                        // 🔹 Build full file path correctly
                                        const filePath = path.join(
                                            downloadDir,
                                            fileName
                                        )

                                        // 🔹 Save the file (binary-safe)
                                        const writeStream =
                                            fs.createWriteStream(filePath)
                                        response.Body.pipe(writeStream)

                                        await new Promise((resolve, reject) => {
                                            writeStream.on('finish', resolve)
                                            writeStream.on('error', reject)
                                        })

                                        console.log(
                                            '✅ File downloaded successfully:',
                                            filePath
                                        )

                                        res.download(
                                            filePath,
                                            'TestRun.xlsx',
                                            (err) => {
                                                if (err) {
                                                    console.error(
                                                        '❌ Error sending file:',
                                                        err
                                                    )
                                                    return
                                                }

                                                try {
                                                    // Delete file
                                                    if (
                                                        fs.existsSync(filePath)
                                                    ) {
                                                        fs.unlinkSync(filePath)
                                                        console.log(
                                                            '🗑️ File deleted successfully'
                                                        )
                                                    }

                                                    // Delete folder (recursive)
                                                    if (
                                                        fs.existsSync(
                                                            downloadDir
                                                        )
                                                    ) {
                                                        fs.rmSync(downloadDir, {
                                                            recursive: true,
                                                            force: true,
                                                        })
                                                        console.log(
                                                            '🧹 Folder deleted successfully'
                                                        )
                                                    }
                                                } catch (deleteErr) {
                                                    console.error(
                                                        '⚠️ Error deleting local files:',
                                                        deleteErr
                                                    )
                                                }
                                            }
                                        )
                                        // res.download(filePath, 'TestRun.xlsx')

                                        // // Delete file
                                        // if (fs.existsSync(filePath))
                                        //     fs.unlinkSync(filePath)
                                        // // Delete folder (recursive)
                                        // if (fs.existsSync(downloadDir))
                                        //     fs.rmSync(downloadDir, {
                                        //         recursive: true,
                                        //         force: true,
                                        //     })
                                        // console.log(
                                        //     '🗑️ Local file and folder deleted successfully'
                                        // )
                                    } else if (mountStorage) {
                                        const filePath = job?.exportedFilePath
                                        const exportedFilePath = path.join(
                                            mountStorage,
                                            filePath
                                        )

                                        res.download(
                                            exportedFilePath,
                                            'TestRun.xlsx'
                                        ) // forces browser download
                                    }
                                } catch (error) {
                                    console.log('error error', error)
                                    res.send({
                                        status: 400,
                                        message: 'No Video found!!',
                                        data: '',
                                    })
                                }
                            } else {
                                res.send({
                                    status: 400,
                                    message: 'No Video found!!',
                                    data: '',
                                })
                            }
                        } else {
                            res.send({
                                status: 400,
                                message: 'No Job found!!',
                                data: '',
                            })
                        }
                    })
                } else {
                    res.send({
                        status: 400,
                        message: 'Bad Request',
                        data: 'User not found!!',
                    })
                }
            })
            // res.send({ status: 200, data: { presignedUrl } })
        }
    } catch (error) {
        console.error('Error streaming video', error)
        res.status(500).json({ error: 'Failed to stream video' })
    }
})

router.get('/v1/download/:userId/:filename', async (req, res) => {
    try {
        const { userId, filename } = req.params
        const key = `downloads/${filename}`
        console.log('userId', userId, filename, key)
        if (!userId) {
            res.send({ status: 204, message: 'User Id Required', data: '' })
        } else {
            const params = {
                Bucket: process.env.AWS_S3_BUCKET,
                Key: key,
                // Expires: 300, // 5 minutes
            }

            try {
                const stream = await s3.send(new GetObjectCommand(params))
                res.setHeader('Content-Type', 'application/octet-stream')
                res.setHeader(
                    'Content-Disposition',
                    `attachment; filename="${filename}"`
                )
                stream.Body.pipe(res)
            } catch (error) {
                console.error('Download error:', error)
                res.status(500).send('Error downloading file')
            }
        }
    } catch (error) {
        console.error('Error streaming video', error)
        res.status(500).json({ error: 'Failed to stream video' })
    }
})

// Proxy for .m3u8 and .ts segments
router.get('/v1/getJob/:userId/:jobId', async (req, res) => {
    const { userId, jobId } = req.params

    if (!userId) {
        res.send({ status: 204, message: 'User Id Required', data: '' })
    } else {
        const job = await Job.findById(jobId, {
            jenkinsJobName: 1,
            linuxScreenRecord: 1,
            jenkinsJobID: 1,
            'testRun.moduleID': 1,
        })
        res.send({ status: 200, message: 'Job found', data: job })
    }
})

// Proxy for .m3u8 and .ts segments
router.get('/v1/getModule/:userId/:moduleId', async (req, res) => {
    const { userId, moduleId } = req.params

    if (!userId) {
        res.send({ status: 204, message: 'User Id Required', data: '' })
    } else {
        const module = await Module.findById(moduleId, {
            suiteName: 1,
        })
        res.send({ status: 200, message: 'Job found', data: module })
    }
})

// Proxy for .m3u8 and .ts segments
router.get(
    '/v1/video/livestream/:jenkinsJobName/:jobId/:streamPath',
    (req, res) => {
        try {
            const { jenkinsJobName } = req.params
            const { jobId } = req.params
            const { streamPath } = req.params // captures the rest of the path

            const jenkinsUrl = jenkinsConfig.streamUrl(
                jenkinsJobName,
                jobId,
                streamPath
            )

            // Optional: if Jenkins needs auth
            const options = {
                url: jenkinsUrl,
                headers: {
                    // Example for Basic Auth (replace if needed)
                    Authorization:
                        'Basic ' + Buffer.from(auth).toString('base64'),
                },
            }

            req.pipe(request(options)).pipe(res)
        } catch (error) {
            res.send({ status: 500, message: 'Error getting info', error })
        }
    }
)

router.post('/v1/deleteJenkinsJobs', async (req, res) => {
    try {
        const templates = (await Template.find()).map((t) => t.name)
        console.log('templates', templates)

        const crumbResponse = await axios.get(jenkinsConfig.getCrumb(), {
            headers: {
                Authorization: jenkinsConfig.headers.Authorization,
            },
        })

        jenkinsConfig.headers['Jenkins-Crumb'] = crumbResponse.data.crumb
        jenkinsConfig.xmlHeaders['Jenkins-Crumb'] = crumbResponse.data.crumb

        let response = await axios.post(
            jenkinsConfig.getAllJobs(),
            {},
            { headers: jenkinsConfig.headers }
        )
        const jobs = response.data.jobs.map((job) => job.name)
        console.log('jobs', jobs)
        const jobsToDelete = jobs
            .filter((job) => !templates.includes(job))
            .filter((job) => job !== 'TestEnsure')
        console.log('jobsToDelete', jobsToDelete)
        jobsToDelete.forEach(async (jobToDelete) => {
            try {
                await axios.post(
                    jenkinsConfig.deleteJob(jobToDelete),
                    {},
                    { headers: jenkinsConfig.headers }
                )
                console.log('Delete Job is success', jobToDelete)
            } catch (err) {
                logger.info(err)
            }
        })
        res.send({ status: 200, data: 'Delete success' })
    } catch (error) {
        console.log('error', error)
        res.send({ status: 500, message: 'Error getting info', error })
    }
})

// Proxy endpoint for streaming
// router.get('/v1/stream/:streamId', async (req, res) => {
//     const { streamId } = req.params

//     // Fetch the stream from Jenkins
//     try {
//         const crumbResponse = await axios.get(jenkinsConfig.getCrumb(), {
//             headers: {
//                 Authorization: jenkinsConfig.headers.Authorization,
//             },
//         })

//         jenkinsConfig.headers['Jenkins-Crumb'] = crumbResponse.data.crumb
//         jenkinsConfig.xmlHeaders['Jenkins-Crumb'] = crumbResponse.data.crumb

//         try {
//             console.log(
//                 jenkinsConfig.streamUrl(
//                     'Test_Live_video_SalesOrder_1',
//                     streamId
//                 )
//             )
//             response = await axios.post(
//                 jenkinsConfig.streamUrl(
//                     'Test_Live_video_SalesOrder_1',
//                     streamId
//                 ),
//                 {},
//                 { headers: jenkinsConfig.headers, responseType: 'stream' }
//             )
//             console.log('Delete Job is success')
//         } catch (err) {
//             logger.info(err)
//         }

//         // Forward the Jenkins stream to the React app
//         res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
//         response.data.pipe(res) // Pipe the Jenkins stream response to the client
//     } catch (error) {
//         console.error('Error fetching stream:', error)
//         res.status(500).send('Error fetching stream')
//     }
// })

async function writeObjectData(dataObj) {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Sheet1')

    sheet.columns = [
        { header: 'ID', key: 'testCaseID', width: 10 },
        { header: 'Name', key: 'testCaseTitle', width: 20 },
        { header: 'Description', key: 'testCaseDescription', width: 30 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Duration', key: 'executionDuration', width: 10 },
        { header: 'Step No', key: 'stepNo', width: 10 },
        { header: 'Step Description', key: 'stepDescription', width: 30 },
        { header: 'Step Status', key: 'stepStatus', width: 15 },
        { header: 'Thumbnail', key: 'thumbnail', width: 15 }, // placeholder column
    ]

    for (const data of dataObj) {
        // Clone data but remove thumbnail (so it's not written as text)
        const { thumbnail, ...rowData } = data
        const row = sheet.addRow(rowData)

        if (thumbnail && thumbnail !== '') {
            const cleanBase64 = thumbnail.replace(
                /^data:image\/\w+;base64,/,
                ''
            )

            const imageId = workbook.addImage({
                base64: cleanBase64,
                extension: 'png',
            })

            const colIndex =
                sheet.columns.findIndex((c) => c.key === 'thumbnail') + 1

            // Insert image at the correct row/col
            sheet.addImage(imageId, {
                tl: { col: colIndex - 1, row: row.number - 1 },
                ext: { width: 60, height: 60 },
            })

            // Increase row height so image is visible
            sheet.getRow(row.number).height = 50
        }
    }

    await workbook.xlsx.writeFile('output.xlsx')
    console.log('Excel file created with embedded images!')
}

/**
 * Generate Excel with test cases and linked thumbnails
 * @param {Array} finalDataObj - array of test steps with optional thumbnails
 */
async function generateTestCasesExcel(
    finalDataObj,
    jobId,
    moduleId,
    IMAGE_WIDTH = 150,
    IMAGE_HEIGHT = 90,
    fileName = 'TestCases'
) {
    const workbook = new ExcelJS.Workbook()

    // ===== Main Sheet =====
    const mainSheet = workbook.addWorksheet('TestCases')
    mainSheet.columns = [
        { header: 'ID', key: 'testCaseID', width: 15 },
        { header: 'Name', key: 'testCaseTitle', width: 25 },
        { header: 'Description', key: 'testCaseDescription', width: 40 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Duration', key: 'executionDuration', width: 10 },
        { header: 'Step No', key: 'stepNo', width: 10 },
        { header: 'Step Description', key: 'stepDescription', width: 40 },
        { header: 'Step Status', key: 'stepStatus', width: 15 },
        { header: 'Thumbnail', key: 'thumbnail', width: 18 },
    ]

    // ===== Image Sheet =====
    const imageSheet = workbook.addWorksheet('Thumbnails')
    const col = 1 // Column A for images
    let imageSheetRow = 2

    // Constants for image sizing
    // const IMAGE_WIDTH = 800
    // const IMAGE_HEIGHT = 600

    for (const rowData of finalDataObj) {
        // Add main sheet row
        const mainRow = mainSheet.addRow({
            testCaseID: rowData.stepNo === 1 ? rowData.testCaseID : '',
            testCaseTitle: rowData.stepNo === 1 ? rowData.testCaseTitle : '',
            testCaseDescription:
                rowData.stepNo === 1 ? rowData.testCaseDescription : '',
            status: rowData.stepNo === 1 ? rowData.status : '',
            executionDuration:
                rowData.stepNo === 1 ? rowData.executionDuration : '',
            stepNo: rowData.stepNo,
            stepDescription: rowData.stepDescription,
            stepStatus: rowData.stepStatus,
            thumbnail: '', // placeholder for link
        })

        // ===== Handle Thumbnail =====
        if (rowData.thumbnail) {
            const cleanBase64 = rowData.thumbnail.replace(
                /^data:image\/\w+;base64,/,
                ''
            )
            const imageId = workbook.addImage({
                base64: cleanBase64,
                extension: 'png',
            })

            // Scale image column & row
            imageSheet.getColumn(col).width = IMAGE_WIDTH / 7
            imageSheet.getRow(imageSheetRow).height = IMAGE_HEIGHT * 0.75

            // Insert image
            imageSheet.addImage(imageId, {
                tl: { col: col - 1, row: imageSheetRow - 1 },
                ext: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT },
            })

            // Link from main sheet to thumbnail
            mainRow.getCell('thumbnail').value = {
                text: '📷 View Screenshot',
                hyperlink: `#'Thumbnails'!A${imageSheetRow}`,
            }
            mainRow.getCell('thumbnail').alignment = {
                vertical: 'middle',
                horizontal: 'center',
            }
            mainRow.getCell('thumbnail').font = {
                color: { argb: 'FF0000FF' },
                underline: true,
            }

            // Back link from image sheet to main sheet
            const backCell = imageSheet.getCell(imageSheetRow, col + 1)
            backCell.value = {
                text: '⬅ Back to Step',
                hyperlink: `#'TestCases'!A${mainRow.number}`,
            }
            backCell.alignment = { vertical: 'middle', horizontal: 'center' }
            backCell.font = { color: { argb: 'FF0000FF' }, underline: true }
            imageSheet.getColumn(col + 1).width = 18

            imageSheetRow++
        }
    }

    let exportedFilePath = path.join(
        'exportedFiles',
        jobId,
        moduleId,
        `${fileName}.xlsx`
    )

    if (process.env.AWS_S3_BUCKET) {
        exportedFilePath = `exportedFiles/${jobId}/${moduleId}/${fileName}.xlsx`

        // ===== Write workbook to buffer instead of file =====
        const buffer = await workbook.xlsx.writeBuffer()

        uploadExcelFileToS3(
            'req',
            'req.params.jobID',
            'req.params.id',
            exportedFilePath,
            buffer
        )
    } else if (process.env.MOUNT_SHARE) {
        const dir = path.dirname(path.join(mountStorage, exportedFilePath))

        console.log('dir', dir)

        // create folders if they don't exist
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        console.log('File will be saved at:', exportedFilePath)

        // ===== Save Excel File =====
        const remoteFilePath = path.join(mountStorage, exportedFilePath)
        console.log('Saving Excel:', remoteFilePath)

        await workbook.xlsx.writeFile(remoteFilePath)
    }

    await Job.updateOne(
        { _id: jobId }, // filter
        { $set: { exportedFilePath } } // update only this field
    )
    console.log('✅ Excel created: TestCases.xlsx')
}

router.post('/v1/exportTestRunResults', async (req, res) => {
    try {
        const { jobId, fileName } = req.body
        const job = await Job.findById(jobId)
        const moduleId = job?.testRun[0]?.moduleID
        let module = await Module.findById(moduleId)

        const IMAGE_WIDTH = 800
        const IMAGE_HEIGHT = 600

        module = await responseTransformer.getModulesDataWithSteps(
            [module],
            module.projectID,
            null,
            null
        )
        module = module[0]

        const jobTestCases = job?.testRun[0]?.testNodes
        const moduleTestCases = module?.testNodes

        /**
         * Generates structured test case rows ready for ExcelJS
         * @param {Array} jobTestCases
         * @param {Array} moduleTestCases
         * @param {Array} ExcludeKeys
         * @param {Object} KEYS - keys like TESTSTEPDESCRIPTION
         * @param {Function} fetchFile - fetch file as buffer
         * @param {Function} getThumbnailBase64Image - returns base64 thumbnail
         */
        const dataObj = await Promise.all(
            jobTestCases.flatMap(async (jobTestCase) => {
                const moduleTestCase = moduleTestCases.find(
                    (m) => m._id.toString() === jobTestCase.testNodeID
                )?.testNode[0]

                const testSteps = moduleTestCase?.testCaseSteps || []
                const jobSteps = jobTestCase?.testCaseSteps || []

                const rows = []
                let stepNo = 1

                // ===== Human-friendly duration =====
                const startTime = moment(jobTestCase.executionStart)
                const endTime = moment(jobTestCase.executionEnd)
                let durationMs = endTime.diff(startTime)
                if (durationMs < 0) durationMs = 0

                const totalSeconds = Math.floor(durationMs / 1000)
                const minutes = Math.floor(totalSeconds / 60)
                const seconds = totalSeconds % 60
                const duration =
                    minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

                for (let i = 0; i < jobSteps.length; i++) {
                    const jobStep = jobSteps[i]
                    const currentTestStep = testSteps[i]

                    if (!currentTestStep) continue

                    // Skip step if any key is in ExcludeKeys
                    const keys = Object.keys(currentTestStep)
                    if (keys.some((k) => ExcludeKeys.includes(k))) continue

                    // Extract step description safely
                    const stepDescription = responseTransformer.findValue(
                        currentTestStep,
                        KEYS.TESTSTEPDESCRIPTION,
                        ExcludeKeys
                    )

                    const stepStatus = jobStep?.status || ''
                    let thumbnail = ''

                    if (jobStep.testStepResultsFile) {
                        const buffer = await fetchFile(
                            jobStep.testStepResultsFile,
                            'buffer'
                        )
                        thumbnail = await getThumbnailBase64Image(
                            buffer,
                            IMAGE_WIDTH,
                            IMAGE_HEIGHT
                        )
                    }

                    rows.push({
                        testCaseID: i === 0 ? moduleTestCase?.testCaseID : '',
                        testCaseTitle:
                            i === 0 ? moduleTestCase?.testCaseTitle : '',
                        testCaseDescription:
                            i === 0 ? moduleTestCase?.testCaseDescription : '',
                        status: i === 0 ? jobTestCase?.status : '',
                        executionDuration: i === 0 ? duration : '',
                        stepNo,
                        stepDescription,
                        stepStatus,
                        thumbnail, // now object with base64 and scaled dimensions
                    })

                    stepNo++
                }

                return rows
            })
        )

        // Flatten the array of arrays (because flatMap + async makes nested arrays)
        const finalDataObj = (await Promise.all(dataObj)).flat()

        // writeObjectData(finalDataObj)
        generateTestCasesExcel(
            finalDataObj,
            jobId,
            moduleId,
            IMAGE_WIDTH,
            IMAGE_HEIGHT,
            fileName
        )
        res.send({ status: 200, data: 'File creation success' })
    } catch (error) {
        console.log('error', error)
        res.send({ status: 500, message: 'Error getting info', error })
    }
})

module.exports = router
