const { Module } = require('../Models/Module')
const Job = require('../Models/Job')
const moduleService = require('./moduleService')

const formatAdoRequestBodyFromJob = async (job, moduleDetails) => {
    const moduleId = moduleDetails?.moduleID
    const module = await moduleService.getModuleById(moduleId)
    const automationStatus = module?.automationStatus
    const mtestNodes = module?.testNodes
    const jTestNodes = moduleDetails?.testNodes
    const jobTestNodes = []
    for (var index = 0; index < mtestNodes?.length; index++) {
        const mTestNode = mtestNodes[index]?.testNode[0]
        const jTestNode = jTestNodes[index]
        const testNodeId = mTestNode._id.toString()

        const testNode = {
            _id: testNodeId,
            id: testNodeId,
            moduleId,
            suiteName: module?.suiteName,
            testCaseTitle: mTestNode?.testCaseTitle,
            testCaseDescription: mTestNode?.testCaseDescription,
            testCaseID: mTestNode?.testCaseID,
            tags: mTestNode?.tags,
            automationStatus,
            testCaseSteps: mTestNode?.testCaseSteps,
            testStepStatuses: jTestNode?.testCaseSteps,
            status: jTestNode?.status,
            executionStart: jTestNode?.executionStart,
            executionEnd: jTestNode?.executionEnd,
            executionDuration: jTestNode?.executionDuration,
        }
        jobTestNodes.push(testNode)
    }
    return jobTestNodes
}

module.exports = {
    formatAdoRequestBodyFromJob,
}
