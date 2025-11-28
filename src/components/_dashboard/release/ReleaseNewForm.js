import * as Yup from 'yup';
import PropTypes from 'prop-types';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { Form, FormikProvider, useFormik, setNestedObjectValues } from 'formik';
import { styled } from '@mui/material/styles';
// material
import { DesktopDatePicker, MobileTimePicker } from '@mui/x-date-pickers';
import {
  Autocomplete,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogActions,
  DialogTitle,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableHead,
  CardHeader,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
  Typography,
  createFilterOptions,
  MenuItem,
  Select,
  Chip,
  Box,
  ListItemText,
  ListSubheader
} from '@mui/material';
// import axios from 'axios';

import { useEffect, useState, useCallback } from 'react';
import { Icon } from '@iconify/react';
import plusFill from '@iconify/icons-eva/plus-fill';
import editFill from '@iconify/icons-eva/edit-fill';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import arrowIosDownwardFill from '@iconify/icons-eva/arrow-ios-downward-fill';
import ModeEditOutlineIcon from '@mui/icons-material/ModeEditOutline';
import trash2Outline from '@iconify/icons-eva/trash-2-outline';
import moment from 'moment/moment';
import { eachDayOfInterval, getDay, parse, format, isValid } from 'date-fns';
import axios from '../../../utils/axiosInstance';
import { varFadeIn, MotionInView } from '../../animate';
// utils
import { useDispatch, useSelector } from '../../../redux/store';
// routes
import { PATH_DASHBOARD } from '../../../routes/paths';
import {
  getCreateRelease,
  getUpdateRelease,
  setReleaseData,
  getReleaseListSuccess,
  setFetchReleaseData,
  setTotalCount
} from '../../../redux/slices/release';

import { getReleaseEditObj } from '../../../_apis_/release';
import { getModuleList, setFilteredModuleList, setFilteredBPModuleList } from '../../../redux/slices/module';
//
import Scrollbar from '../../Scrollbar';
import API from '../../../services';
import { getSessionObj } from '../../../utils/jwt';
import { getIDBCurrentProject } from '../../../main';
import LoadingScreen from '../../LoadingScreen';
import { RELEASE_SCHEDULE, EXCLUDE_KEYS, EXCLUDE_SET_KEYS } from '../../../Constants';
import * as XLSX from 'xlsx';

const LabelStyle = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.palette?.text?.primary
}));

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

// ----------------------------------------------------------------------

const WEEK_DAYS = [
  {
    week: 0,
    day: 'Sunday'
  },
  { week: 1, day: 'Monday' },
  { week: 2, day: 'Tuesday' },
  { week: 3, day: 'Wednesday' },
  { week: 4, day: 'Thursday' },
  { week: 5, day: 'Friday' },
  { week: 6, day: 'Saturday' }
];

// ----------------------------------------------------------------------

const MONTHS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
];

// ----------------------------------------------------------------------

ReleaseNewForm.propTypes = {
  isEdit: PropTypes.bool,
  currentRelease: PropTypes.object
};

export default function ReleaseNewForm({ isEdit, currentRelease }) {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useDispatch();
  const { appendUrl } = useSelector((state) => state.user);
  const { currentProject } = useSelector((state) => state.project);
  const { moduleList, filteredModuleList, filteredBPModuleList } = useSelector((state) => state.module);
  const { releaseList, releaseData, fetchReleaseData } = useSelector((state) => state.release);
  const [openAddProject, setOpenAddProject] = useState(false);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [priority, setPriority] = useState([]);
  const [testCaseIDs, setTestCaseIDs] = useState();
  const [selectedTestCases, setSelectedTestCases] = useState();
  const [module, setModule] = useState();
  const [executionData, setExecutionData] = useState(currentRelease ? currentRelease.modules : []);
  const [executionDataWithOV, setExecutionDataWithOV] = useState(currentRelease ? currentRelease.modules : []);
  const [businessProcess, setBusinessProcess] = useState(false);
  const [businessProcessTags, setBusinessProcessTags] = useState([]);
  const [selectedBusinessProcesses, setSelectedBusinessProcesses] = useState([]);
  const [processBPData, setProcessBPData] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [testDataToEdit, setTestDataToEdit] = useState({});
  const [updatedTestData, setUpdatedTestData] = useState();
  const [isLoading, setIsloading] = useState(true);
  const [value, setValue] = useState(new Date());
  const [releaseSchedule, setReleaseSchedule] = useState();
  const [showSchedule, setShowSchedule] = useState(false);
  const [outputVariables, setOutputVariables] = useState([]);
  const [dependsOn, setDependsOn] = useState(null);
  const [multiModuleSelect, setMultiModuleSelect] = useState(false);
  const [executionDataEdit, setExecutionDataEdit] = useState(false);
  const [moduleDataEdit, setModuleDataEdit] = useState({});
  const [saveRelease, setSaveRelease] = useState(false);
  const [canDeleteRelease, setCanDeleteRelease] = useState(false);
  const [moduleNames, setModuleNames] = useState([]);
  const [prevTestDataToEdit, setPrevTestDataToEdit] = useState();
  const [prevTestDataToEditWithOV, setPrevTestDataToEditWithOV] = useState();

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  const filter = createFilterOptions();

  const navigateToLink = (url) => {
    navigate(getUrl(url));
  };

  const handleClose = () => {
    setOpen(false);
    setCanDeleteRelease(false);
  };

  // Custom validation function to check if a specific weekday falls between two dates
  const checkWeekdayInRange = (schedule, startDate, endDate, weekday) => {
    if (startDate && endDate && weekday) {
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const interval = { start, end };

        const daysInRange = eachDayOfInterval(interval);

        const dayExists = daysInRange.some(
          (date) =>
            (schedule === RELEASE_SCHEDULE.WEEKLY && parseInt(getDay(date), 10) === parseInt(weekday, 10)) ||
            (schedule === RELEASE_SCHEDULE.MONTHLY && parseInt(date.getDate(), 10) === parseInt(weekday, 10))
        );

        if (!dayExists) {
          setOpenAddProject(false);
        }

        return dayExists;
      } catch (err) {
        console.log('error', err);
      }
    }
    return true;
  };

  // Helper function to check if the day is within the range
  // const checkDayInRange = (start, end, day) => {
  //   if (startDate && endDate && weekday) {
  //     try {
  //       const start = new Date(startDate);
  //       const end = new Date(endDate);
  //       // const interval = { start, end };

  //       const interval = { start, end };
  //       const daysInRange = eachDayOfInterval(interval);
  //       return daysInRange.some((date) => parseInt(date.getDate(), 10) === parseInt(day, 10));
  //     } catch (err) {
  //       //
  //     }
  //   }
  // };

  // const NewReleaseSchema = Yup.object().shape({
  //   name: Yup.string().min(5, 'Release name should be mote than 5 characters').required('Release Name is required'),
  //   // version: Yup.string().required('Release Version is required'),
  //   releaseDate: Yup.date().when([], {
  //     is: () => !isEdit, // condition
  //     then: Yup.date().min(new Date(), 'Release Date cannot be in the past'), // validation if condition is true
  //     otherwise: Yup.date() // validation if condition is false
  //   }),
  //   scheduleStart: Yup.date().required('Start date is required'),
  //   // scheduleEnd: Yup.date().required('End date is required'),
  //   scheduleEnd: Yup.date().min(Yup.ref('scheduleStart'), 'End date must be later than start date'),

  //   // scheduleEnd: Yup.date()
  //   //   .required('End date is required')
  //   //   // eslint-disable-next-line
  //   //   .when(['scheduleStart', 'schedule'], (startDate, schedule, schema) => {
  //   //     if (schedule !== RELEASE_SCHEDULE.NO_REPEAT)
  //   //       return schema.test({
  //   //         name: 'is-at-least-one-week-after-startDate',
  //   //         exclusive: false,
  //   //         message: 'End date must be at least one week after start date',
  //   //         // eslint-disable-next-line
  //   //         test: function (value) {
  //   //           if (!startDate || !value) return true; // Ignore if startDate or endDate is not set
  //   //           const oneWeekAfterStartDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  //   //           return value >= oneWeekAfterStartDate;
  //   //         }
  //   //       });
  //   //   }),
  //   schedule: Yup.string(),
  //   weekDay: Yup.string()
  //     .when('schedule', {
  //       is: (value) => value === RELEASE_SCHEDULE.WEEKLY && values.weekDay === '', // condition
  //       then: Yup.string().required('Week day is required'), // validation if condition is true
  //       otherwise: Yup.string() // validation if condition is false
  //     })
  //     .test('is-weekday-in-range', 'The specified weekday does not fall within the date range', (value, context) => {
  //       const { schedule, scheduleStart, scheduleEnd } = context?.parent;
  //       if (schedule === RELEASE_SCHEDULE.MONTHLY) return true;
  //       return checkWeekdayInRange(schedule, scheduleStart, scheduleEnd, value);
  //     }),
  //   scheduleDay: Yup.string()
  //     .when('schedule', {
  //       is: (value) => value === RELEASE_SCHEDULE.MONTHLY && values.scheduleDay === '', // condition
  //       then: Yup.string().required('Day is required'), // validation if condition is true
  //       otherwise: Yup.string() // validation if condition is false
  //     })
  //     .test('is-day-in-range', 'The specified day does not fall within the date range', (value, context) => {
  //       const { schedule, scheduleStart, scheduleEnd } = context?.parent;
  //       if (schedule === RELEASE_SCHEDULE.WEEKLY) return true;
  //       return checkWeekdayInRange(schedule, scheduleStart, scheduleEnd, value);
  //     })
  // });

  const NewReleaseSchema = Yup.object().shape({
    name: Yup.string().min(5, 'Release name should be more than 5 characters').required('Release Name is required'),
    // releaseDate: Yup.date().when('$isEdit', {
    //   is: false, // when isEdit === false
    //   then: Yup.date().min(new Date(), 'Release Date cannot be in the past'),
    //   otherwise: Yup.date()
    // }),
    // releaseDate: Yup.date().when([], (releaseDate, schema, context) => {
    //   // const isEdit = context?.options?.context?.isEdit;
    //   if (!isEdit) {
    //     return schema.min(new Date(new Date().setHours(0, 0, 0, 0)), 'Release Date cannot be in the past');
    //   }
    //   return schema;
    // }),
    releaseDate: Yup.date().when(
      '$isEdit', // 👈 this refers to context.isEdit
      (isEdit, schema) => {
        if (isEdit) {
          // Edit mode → just required
          return schema.required('Release Date is required');
        }
        // Create mode → must be today or later
        return schema.min(new Date(new Date().setHours(0, 0, 0, 0)), 'Release Date cannot be in the past');
      }
    ),
    scheduleStart: Yup.date().required('Start date is required'),
    scheduleEnd: Yup.date().min(Yup.ref('scheduleStart'), 'End date must be later than start date'),
    schedule: Yup.string(),
    weekDay: Yup.string()
      .when('schedule', ([schedule], schema) => {
        if (schedule === RELEASE_SCHEDULE.WEEKLY) {
          return schema.required('Week day is required');
        }
        return schema;
      })
      // eslint-disable-next-line react/no-this-in-sfc
      .test('is-weekday-in-range', 'The specified weekday does not fall within the date range', (value, context) => {
        const { schedule, scheduleStart, scheduleEnd } = context.parent;
        if (schedule === RELEASE_SCHEDULE.MONTHLY) return true;
        return checkWeekdayInRange(schedule, scheduleStart, scheduleEnd, value);
      }),
    scheduleDay: Yup.string()
      .when('schedule', ([schedule], schema) => {
        if (schedule === RELEASE_SCHEDULE.MONTHLY) {
          return schema.required('Day is required');
        }
        return schema;
      })
      .test('is-day-in-range', 'The specified day does not fall within the date range', (value, context) => {
        const { schedule, scheduleStart, scheduleEnd } = context?.parent;
        if (schedule === RELEASE_SCHEDULE.WEEKLY) return true;
        return checkWeekdayInRange(schedule, scheduleStart, scheduleEnd, value);
      })
    // multiModuleSelection: Yup.string()
    //   .oneOf(['Modules with Details', 'Modules only'], 'Invalid selection')
    //   .required('Module selection type is required'),

    // moduleIDs: Yup.array().of(Yup.string()).min(1, 'At least one module must be selected')
  });

  // const getReleaseList = useCallback(async () => {
  //   try {
  //     const projectSerialized = await getIDBCurrentProject();
  //     setIsloading(false);
  //     if (projectSerialized && projectSerialized._id && fetchReleaseData) {
  //       setFetchReleaseData(dispatch, false);
  //       const data = await axios({
  //         method: 'get',
  //         url: API.releases.getReleaseByPID(projectSerialized._id, 'createdAt', 'desc', '10', '0'),
  //         headers: {
  //           Authorization: `Bearer ${getSessionObj('accessToken')}`
  //         }
  //       });
  //       if (response.data instanceof Array) await dispatch(getReleaseListSuccess(response.data));
  //     }
  //   } catch (error) {
  //     // dispatch(slice.actions.hasError(error));
  //   }
  // }, [dispatch, fetchReleaseData]);

  const getReleaseList = useCallback(async () => {
    setIsloading(true);
    try {
      const projectSerialized = await getIDBCurrentProject();
      if (projectSerialized && projectSerialized._id) {
        setFetchReleaseData(dispatch, false);
        const data = await axios({
          method: 'get',
          url: API.releases.getReleaseByPID(projectSerialized._id, 'createdAt', 'desc', '10', '0'),
          headers: {
            Authorization: `Bearer ${getSessionObj('accessToken')}`
          }
        });
        // console.log('data.totalCount', data?.data?.totalCount);
        const releases = data?.data?.response;
        const totalCount = data?.data?.totalCount;
        setTotalCount(dispatch, totalCount);

        if (releases instanceof Array) {
          dispatch(getReleaseListSuccess(releases));
        } else {
          dispatch(getReleaseListSuccess([]));
        }
      }
    } catch (error) {
      // dispatch(slice.actions.hasError(error));
    }
    setReleaseData(dispatch, null);
    setIsloading(false);
  }, [dispatch, fetchReleaseData]);

  const createRelease = async () => {
    getCreateRelease(dispatch, releaseData);
    getReleaseList();
  };

  const updateRelease = async () => {
    getUpdateRelease(dispatch, currentRelease._id, releaseData);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // const getDateValue = (value) => {
  //   if (value instanceof Date) {
  //     return value;
  //   } else {
  //     const parsed = parse(value, 'MM/dd/yyyy', new Date());
  //     return isValid(parsed) ? parsed : new Date();
  //   }
  // };

  const getDateValue = (value) => {
    if (value instanceof Date) {
      return value;
    } else {
      // Try multiple formats
      const formats = ['MM/dd/yyyy hh:mm:ss a', 'MM/dd/yyyy'];

      for (let fmt of formats) {
        const parsed = parse(value, fmt, new Date());
        if (isValid(parsed)) {
          return parsed;
        }
      }

      // fallback to current date
      return new Date();
    }
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: currentRelease?.releaseName || releaseData?.releaseName,
      description: currentRelease?.description || releaseData?.description,
      version: releaseData?.releaseVersion || currentRelease?.version || '',
      schedule: releaseData?.schedule || currentRelease?.schedule || '',
      // scheduleStart: releaseData?.scheduledOn?.scheduleStart || parse(formattedDate, 'dd/MM/yyyy', new Date()),
      // scheduleEnd: releaseData?.scheduledOn?.scheduleEnd || parse(formattedDate, 'dd/MM/yyyy', new Date()),
      scheduleStart: releaseData?.scheduledOn?.scheduleStart || format(today, 'MM/dd/yyyy'),
      scheduleEnd: releaseData?.scheduledOn?.scheduleEnd || format(today, 'MM/dd/yyyy'),
      // scheduleStart: releaseData?.scheduledOn?.scheduleStart ? new Date(releaseData.scheduledOn.scheduleStart) : today, // keep as Date object
      // scheduleEnd: releaseData?.scheduledOn?.scheduleEnd ? new Date(releaseData.scheduledOn.scheduleEnd) : today,
      weekDay: releaseData?.scheduledOn?.wekDay || '',
      scheduleDay: releaseData?.scheduledOn?.monthDay || '',
      releaseDate: releaseData?.releaseDate || format(today, 'MM/dd/yyyy hh:mm:ss a'),
      // releaseDate: releaseData?.releaseDate ? new Date(releaseData.releaseDate) : today,
      multiModuleSelection:
        currentRelease?.multiModuleSelection || releaseData?.multiModuleSelection || 'Modules with Details',
      moduleIDs: currentRelease?.modules || releaseData?.modules || []
    },
    validationSchema: NewReleaseSchema,
    context: { isEdit },
    validate: async (values) => {
      try {
        await NewReleaseSchema.validate(values, { context: { isEdit }, abortEarly: false });
        return {};
      } catch (err) {
        const errors = {};
        if (Array.isArray(err.inner)) {
          err.inner.forEach((error) => {
            if (!errors[error.path]) errors[error.path] = error.message;
          });
        } else if (err.path) {
          errors[err.path] = err.message;
        }
        return errors;
      }
    },
    onSubmit: async (values, { setSubmitting, resetForm, setErrors }) => {
      try {
        setSubmitting(false);
        const release = releaseList?.find((release) => release.releaseName === releaseData.releaseName);
        if (release && !isEdit) {
          setOpen(true);
        }
        if ((!release && releaseData && releaseData?.modules?.length !== 0) || (release && isEdit)) {
          if (!isEdit) createRelease();
          else updateRelease();
          resetForm();
          enqueueSnackbar(!isEdit ? 'Release created successfully' : 'Release changes saved', { variant: 'success' });
          navigateToLink(PATH_DASHBOARD.release.allReleases);
        }
      } catch (error) {
        setSubmitting(false);
        setErrors(error);
      }
    }
  });

  const handleReleaseNameChange = async (event) => {
    const { value } = event.target;
    setFieldValue('name', value);
    let data = {};
    if (releaseData) {
      data = { ...releaseData, releaseName: value };
      setFieldValue('scheduleStart', values.scheduleStart);
      setFieldValue('scheduleEnd', values.scheduleEnd);
    } else {
      data = { releaseName: value, modules: [] };
      setFieldValue('scheduleStart', new Date());
      setFieldValue('scheduleEnd', new Date());
    }
    setReleaseData(dispatch, data);
  };

  const getBusinessProcessTags = useCallback(() => {
    // console.log('moduleList', moduleList);
    if (moduleList && processBPData) {
      let bpTags = moduleList?.map((module) => module.businessProcess).filter((n) => n);

      bpTags = [...new Set([...bpTags])];
      if (bpTags.length !== 0) {
        setBusinessProcessTags(bpTags);
        // setBusinessProcess(true);
      } else {
        setBusinessProcessTags([]);
        // setBusinessProcess(false);
      }
      setProcessBPData(false);
    }
  }, [moduleList, processBPData]);

  const handleAddProjectView = async () => {
    // As the time field value is not being sent when not touched by user,
    // Calling the respective function when clicked on "Add Module"
    if (formik.values.schedule !== '') handleScheduleTimeChange(value);
    const errors = await formik.validateForm();
    if (Object.keys(errors).length === 0) {
      setOpenAddProject(!openAddProject);
    } else {
      formik.setTouched(setNestedObjectValues(errors, true));
    }

    getBusinessProcessTags();
    setTags([]);
    setPriority([]);
    setTestCaseIDs(null);
    setSelectedTestCases(null);
    setExecutionData(null);
    // setOpenAddProject(false);
  };

  const initiateReleaseData = (filteredBPModuleList) => {
    const formData = {};
    let mids = [];
    formData.projectID = currentProject._id;
    formData.releaseName = values.name;
    formData.description = values.description;
    formData.version = values.version;
    formData.releaseVersion = values.version;
    formData.releaseDate = moment(values.releaseDate).format('MM/DD/YYYY hh:mm:ss A');
    formData.schedule = values.schedule || RELEASE_SCHEDULE.NO_REPEAT;
    formData.scheduledOn = releaseData?.scheduledOn;
    const moduleObjs = [];
    filteredBPModuleList?.forEach((module) => {
      const moduleObj = {};
      const testNodeIds = [];
      const testCaseIDs = [];
      module?.testNodes.forEach((m) => {
        testNodeIds.push(m._id);
        testCaseIDs.push(`${m.testNode[0].testCaseID} - ${m.testNode[0].testCaseDescription}`);
      });
      moduleObj.name = module.suiteName;
      moduleObj.moduleID = module._id;
      moduleObj.testNodes = testNodeIds;
      moduleObj.testCaseIDs = testCaseIDs;
      moduleObj.tags = values.tags;
      moduleObj.testPlaceholders = module?.testPlaceholders;
      mids.push(module._id);
      moduleObjs.push(moduleObj);
    });
    if (releaseData.modules.length === 0) {
      formData.modules = moduleObjs;
    } else {
      const fModules = [...releaseData?.modules];
      const mids = releaseData.modules?.map((module) => module.moduleID);

      moduleObjs.forEach((m) => {
        if (!mids.includes(m.moduleID)) {
          fModules.push(m);
        }
      });

      formData.modules = fModules;
    }
    mids = formData.modules?.map((m) => m.moduleID);
    const fModuleList = moduleList?.filter((m) => !mids?.includes(m._id));
    setFilteredModuleList(dispatch, fModuleList);
    setReleaseData(dispatch, formData);
  };

  const handleBusinessProcessView = async () => {
    const modules = moduleList?.filter((m) => selectedBusinessProcesses.includes(m.businessProcess));
    setFilteredBPModuleList(dispatch, modules);
    initiateReleaseData(modules);
  };

  const { values, errors, touched, handleSubmit, isSubmitting, setFieldValue, getFieldProps } = formik;

  const getReleaseToEdit = useCallback(async () => {
    try {
      setIsloading(true);
      const release = await getReleaseEditObj(currentRelease?._id);
      setReleaseData(dispatch, release);
      setIsloading(false);
      const date = release?.releaseDate ? new Date(release?.releaseDate) : new Date();
      const mids = release.modules?.map((m) => m.moduleID);
      const fModuleList = moduleList?.filter((m) => !mids?.includes(m._id));
      setFilteredModuleList(dispatch, fModuleList);
      const releaseModules = release?.modules;
      const outputVariables = [];
      releaseModules?.forEach((module) => {
        module?.outputVariables?.forEach((outputVariable) => {
          outputVariables.push(`${module.name} - ${outputVariable}`);
        });
        if (currentProject?.apiRequestFiles) {
          Object.keys(currentProject?.apiRequestFiles)?.forEach((apiRequestFile) => {
            outputVariables.push(`api - ${apiRequestFile}`);
          });
        }
      });
      setOutputVariables(outputVariables);
      if (release.schedule !== RELEASE_SCHEDULE.NO_REPEAT) {
        setShowSchedule(true);
        const { scheduledOn } = release;
        setFieldValue('scheduleStart', scheduledOn?.scheduleStart);
        setFieldValue('scheduleEnd', scheduledOn?.scheduleEnd);
        // const newTime = new Date();
        // const hoursValue = scheduledOn?.time?.split(':')[0];
        // const minutesValue = scheduledOn?.time?.split(':')[1];
        // newTime.setHours(hoursValue, minutesValue);
        setValue(scheduledOn?.time);
        if (release.schedule === RELEASE_SCHEDULE.WEEKLY) setFieldValue('weekDay', scheduledOn?.weekDay);
        else if (release.schedule === RELEASE_SCHEDULE.MONTHLY) setFieldValue('scheduleDay', scheduledOn?.monthDay);
      }
    } catch (error) {
      // dispatch(slice.actions.hasError(error));
    }
  }, [dispatch, currentRelease, setFieldValue, moduleList]);

  const addProjectSchema = Yup.object().shape({});

  const addProjectFormik = useFormik({
    enableReinitialize: true,
    initialValues: {
      moduleIds: [],
      tags: tags || [],
      testCaseIDs: [],
      testCases: [],
      priority: []
    },
    validationSchema: addProjectSchema
  });

  const handleReleaseVersionChange = (event) => {
    setFieldValue('version', event.target.value);
    const data = { ...releaseData, releaseVersion: event.target.value };
    setReleaseData(dispatch, data);
  };

  const handleReleaseDescChange = (event) => {
    setFieldValue('description', event.target.value);
    const data = { ...releaseData, description: event.target.value };
    setReleaseData(dispatch, data);
  };

  const handleReleaseDateChange = (event) => {
    setFieldValue('releaseDate', event);
  };

  const handleScheduleStartChange = (event) => {
    const scheduleStart = moment(event).format('MM/DD/YYYY') || values.scheduleStart;
    setFieldValue('scheduleStart', scheduleStart);
    const { scheduledOn } = releaseData;
    if (scheduledOn) {
      const data = { ...scheduledOn, scheduleStart };
      setReleaseData(dispatch, { ...releaseData, schedule: values.schedule, scheduledOn: data });
    } else {
      const scheduleEnd = moment(event).format('MM/DD/YYYY') || values.scheduleEnd;
      const time = moment(event).format('HH:mm');
      const scheduledOn = { scheduleStart, scheduleEnd, time };
      setReleaseData(dispatch, { ...releaseData, schedule: values.schedule, scheduledOn });
    }
  };

  const handleScheduleEndChange = async (event) => {
    const { scheduleStart } = values;
    const scheduleEnd = moment(event).format('MM/DD/YYYY') || values.scheduleEnd;
    setFieldValue('scheduleEnd', scheduleEnd);
    const { scheduledOn } = releaseData;
    if (scheduledOn) {
      const data = { ...scheduledOn, scheduleStart, scheduleEnd };
      setReleaseData(dispatch, { ...releaseData, schedule: values.schedule, scheduledOn: data });
    } else {
      const { scheduleStart } = values;
      const scheduledOn = { scheduleStart, scheduleEnd };
      setReleaseData(dispatch, { ...releaseData, schedule: values.schedule, scheduledOn });
    }

    const result = new Date(moment(event).format('MM/DD/YYYY')) < new Date(scheduleStart);
    const errors = await formik.validateForm();
    if (Object.keys(errors).length !== 0) {
      formik.setTouched(setNestedObjectValues(errors, true));
    } else if (result) {
      formik.setTouched(setNestedObjectValues({ scheduleEnd: 'End date must be later than start date' }, true));
    }
  };

  const handleScheduleWeekDayChange = async (event) => {
    const weekDay = event.target.value;
    const { scheduledOn } = releaseData;
    if (scheduledOn) {
      const data = { ...scheduledOn, weekDay };
      setFieldValue('weekDay', weekDay);
      setFieldValue('scheduleDay', '');
      delete data.monthDay;
      setReleaseData(dispatch, { ...releaseData, schedule: values.schedule, scheduledOn: data });
    } else {
      const { scheduleStart, scheduleEnd } = values;
      const scheduledOn = { scheduleStart, scheduleEnd, weekDay };
      setReleaseData(dispatch, { ...releaseData, schedule: values.schedule, scheduledOn });
    }
  };

  const handleScheduleDayChange = async (event) => {
    const monthDay = event.target.value;
    const { scheduledOn } = releaseData;
    if (scheduledOn) {
      const data = { ...scheduledOn, monthDay };
      setFieldValue('weekDay', '');
      setFieldValue('scheduleDay', monthDay);
      delete data.weekDay;
      setReleaseData(dispatch, { ...releaseData, schedule: values.schedule, scheduledOn: data });
    } else {
      const { scheduleStart, scheduleEnd } = values;
      const scheduledOn = { scheduleStart, scheduleEnd, monthDay };
      setReleaseData(dispatch, { ...releaseData, schedule: values.schedule, scheduledOn });
    }
  };

  const handleScheduleTimeChange = async (newValue) => {
    const time = newValue;
    setValue(newValue);
    const { scheduledOn } = releaseData;
    if (scheduledOn) {
      const data = { ...scheduledOn, time };
      setReleaseData(dispatch, { ...releaseData, schedule: values.schedule, scheduledOn: data });
    } else {
      const { scheduleStart, scheduleEnd } = values;
      const scheduledOn = { scheduleStart, scheduleEnd, time };
      setReleaseData(dispatch, { ...releaseData, schedule: values.schedule, scheduledOn });
    }
  };

  const handleModulesChange = async (event) => {
    const moduleId = event.target.value;
    const module = moduleList?.filter((module) => module._id === moduleId)[0];
    setModule(module);
    setTestDataToEdit({});
    let tags = [];
    let priority = ['P1'];
    const ids = ['All'];
    const selected = ['All'];
    module?.testNodes?.map((testCase) => {
      ids.push(`${testCase.testNode[0].testCaseID} - ${testCase.testNode[0].testCaseTitle}`);
      selected.push(`${testCase.testNode[0].testCaseID} - ${testCase.testNode[0].testCaseTitle}`);
      const testCaseTags = testCase.testNode[0].tags;
      const testCasePriority = testCase.testNode[0].priority;
      tags = [...new Set([...tags, ...testCaseTags])];
      if (testCasePriority) priority = [...new Set([...priority, testCasePriority])];
      return null;
    });
    setTestCaseIDs(ids);
    setSelectedTestCases(selected);
    setTags(tags);
    setPriority(priority);
    setExecutionData(module?.testPlaceholders);
    const testPlaceholdersWithOV = [];
    const apiRequestFiles = currentProject?.requestFiles?.map((apiRequestFile) => {
      return `api - ${apiRequestFile?.apiRequestName}`;
    });
    module?.testPlaceholders?.forEach((testPlaceholders) => {
      const keys = Object.keys(testPlaceholders);
      const newTps = {};

      keys.forEach((key) => {
        let value = null;
        if (apiRequestFiles) value = [testPlaceholders[key], ...outputVariables, ...apiRequestFiles];
        else value = [testPlaceholders[key], ...outputVariables];
        newTps[key] = value;
      });

      // testPlaceholdersWithOV.push(newTps);

      testPlaceholdersWithOV.push(newTps);
    });

    setExecutionDataWithOV(testPlaceholdersWithOV);
  };

  const handleTagsChange = async (event, newValue) => {
    // const ids = ['All'];
    const selected = ['All'];
    module?.testNodes?.forEach((testCase) => {
      const tags = testCase?.testNode[0].tags;
      tags?.forEach((tag) => {
        if (newValue?.includes(tag)) {
          // ids.push(`${testCase.testNode[0].testCaseID} - ${testCase.testNode[0].testCaseTitle}`);
          selected.push(`${testCase.testNode[0].testCaseID} - ${testCase.testNode[0].testCaseTitle}`);
        }
      });
    });
    // setTestCaseIDs([...new Set(ids)]);
    setSelectedTestCases([...new Set(selected)]);
    setSelectedTags(newValue);
    setFieldValue('tags', newValue);
  };

  const handleBusinessProcessTagsChange = (event, tags) => {
    let filteredModules = [];
    setSelectedBusinessProcesses(tags);
    if (tags?.length !== 0) {
      tags?.forEach((tag) => {
        const modules = moduleList.filter((module) => module.businessProcess === tag);
        filteredModules = [...filteredModules, ...modules];
      });
    }
    if (filteredModules?.length !== 0) setFilteredBPModuleList(dispatch, filteredModules);
    else if (tags?.length === 0) setFilteredBPModuleList(dispatch, null);
  };

  const handlePriorityChange = async (event, newValue) => {
    // const ids = ['All'];
    const selected = ['All'];
    module?.testNodes?.forEach((testCase) => {
      const tags = testCase?.testNode[0].tags;
      const testCasePriority = testCase?.testNode[0].priority;
      if (testCasePriority) {
        tags?.forEach((tag) => {
          if (
            (selectedTags.includes(tag) && newValue?.includes(testCasePriority)) ||
            (selectedTags.includes(tag) && newValue?.length === 0)
          ) {
            // ids.push(`${testCase.testNode[0].testCaseID} - ${testCase.testNode[0].testCaseTitle}`);
            selected.push(`${testCase.testNode[0].testCaseID} - ${testCase.testNode[0].testCaseTitle}`);
          }
        });
        // setTestCaseIDs([...new Set(ids)]);
        setSelectedTestCases([...new Set(selected)]);
      }
    });
  };

  const handleExecutionDataChange = async (event, key) => {
    const { value } = event.target;
    const data = { ...executionData, [key]: value };
    setExecutionData(data);
  };

  // const [valueOV, setValueOV] = useState(null);

  const handleExecutionDataWithOVChange = async (event, key, value, moduleId) => {
    const prevValue = executionDataWithOV[0][key];
    const data = { ...executionDataWithOV[0], [key]: [...new Set([value, ...prevValue])] };
    setExecutionDataWithOV([data]);
    const edata = { ...executionData[0], [key]: value };
    setExecutionData([edata]);
    const texecutiondata = [edata];
    if (releaseData) {
      const updatedModules = releaseData.modules.map((module) => {
        if (module.moduleID === testDataToEdit?.moduleId || module.moduleID === moduleId) {
          const updatedTestPlaceholders = texecutiondata;

          return {
            ...module,
            testPlaceholders: updatedTestPlaceholders
          };
        }
        return module;
      });

      setReleaseData(dispatch, {
        ...releaseData,
        modules: updatedModules
      });
    }
    if (outputVariables?.includes(value)) {
      const module = moduleList?.find((module) => module.suiteName === value.split('-')[0].trim());
      setDependsOn(module._id);
    }
  };
  const handleExecutionMultipleDataWithOVChange = async (event, key, value) => {
    const prevValue = executionDataWithOV[testDataToEdit?.index][key];
    const data = { ...executionDataWithOV[testDataToEdit?.index], [key]: [...new Set([value, ...prevValue])] };
    const edata = [...executionDataWithOV];
    edata[testDataToEdit?.index] = data;
    setExecutionDataWithOV(edata);
    const executiondata = [...executionData];
    executiondata[testDataToEdit?.index] = { ...executionData[testDataToEdit?.index], [key]: value };
    setExecutionData(executiondata);
    const texecutiondata = executiondata;
    if (releaseData) {
      const updatedModules = releaseData.modules.map((module) => {
        if (module.moduleID === testDataToEdit?.moduleId) {
          const updatedTestPlaceholders = texecutiondata;

          return {
            ...module,
            testPlaceholders: updatedTestPlaceholders
          };
        }
        return module;
      });

      setReleaseData(dispatch, {
        ...releaseData,
        modules: updatedModules
      });
    }
    if (outputVariables?.includes(value)) {
      const module = moduleList?.find((module) => module.suiteName === value.split('-')[0].trim());
      setDependsOn(module._id);
    }
  };

  const handleSingleRowExecutionDataChange = async (event, key) => {
    const { value } = event.target;
    const data = [...executionData];
    data[0] = { ...data[0], [key]: value };
    setExecutionData(data);
    if (outputVariables?.includes(value)) {
      const module = moduleList?.find((module) => module.suiteName === value.split('-')[0].trim());
      setDependsOn(module._id);
    }
  };
  const handleMultipleRowExecutionDataChange = async (event, key, index) => {
    const { value } = event.target;
    const data = [...executionData];

    // Update the specific row at the given index
    data[index] = { ...data[index], [key]: value };
    setExecutionData(data);

    // If the value is in outputVariables, update dependsOn for that row
    if (outputVariables?.includes(value)) {
      const module = moduleList?.find((module) => module.suiteName === value.split('-')[0].trim());

      // Optional: if you want to store dependsOn per row
      if (module) {
        data[index] = { ...data[index], dependsOn: module._id };
        setExecutionData([...data]);
      }
    }
  };

  const handleAddProjects = async () => {
    const testNodeIds = [];
    const testCaseIDs = [];
    if (selectedTestCases) {
      if (selectedTestCases[0] === 'All' && selectedTestCases.length - 1 === module?.testNodes?.length) {
        module?.testNodes?.map((testCase) => {
          testNodeIds.push(testCase?._id);
          testCaseIDs.push(`${testCase.testNode[0].testCaseID} - ${testCase.testNode[0].testCaseTitle}`);
          return null;
        });
      } else {
        module?.testNodes?.map((testCase) => {
          selectedTestCases?.map((selectedTestCase) => {
            const id = selectedTestCase.split(' ')[0];
            let testCaseFound = false;
            testCaseIDs.forEach((testCaseId) => {
              if (testCaseId.includes(id)) testCaseFound = true;
            });
            if (id === testCase?.testNode[0].testCaseID && !testCaseFound) {
              testNodeIds.push(testCase?._id);
              testCaseIDs.push(`${testCase.testNode[0].testCaseID} - ${testCase.testNode[0].testCaseTitle}`);
            }
            return null;
          });
          return null;
        });
      }

      const moduleObj = {};
      moduleObj.name = module.suiteName;
      moduleObj.moduleID = module._id;
      moduleObj.testNodes = testNodeIds;
      moduleObj.testCaseIDs = testCaseIDs;
      moduleObj.tags = values.tags;
      moduleObj.dependsOn = dependsOn;
      moduleObj.testPlaceholders = executionData;

      setModuleDataEdit((prev) => ({
        ...prev,
        [module._id]: false
      }));

      const newValues = [];
      module?.outputVariables?.forEach((outputVariable) => {
        newValues.push(`${module.suiteName} - ${outputVariable}`);
      });
      if (currentProject?.apiRequestFiles) {
        Object.keys(currentProject?.apiRequestFiles)?.forEach((apiRequestFile) => {
          newValues.push(`api - ${apiRequestFile}`);
        });
      }

      const updated = Array.from(
        new Set([
          ...outputVariables,
          ...newValues // newValues must be an array
        ])
      );

      setOutputVariables(updated);

      if (releaseData) {
        const { modules } = releaseData;
        const data = {};
        const moduleIndex = modules?.findIndex((mod) => mod.name === module.suiteName);
        data.projectID = currentProject._id;
        data.releaseName = values.name;
        data.description = values.description;
        data.version = values.version;
        data.releaseVersion = values.version;
        data.schedule = values.schedule || RELEASE_SCHEDULE.NO_REPEAT;
        data.scheduledOn = releaseData.scheduledOn;
        data.releaseDate = moment(values.releaseDate).format('MM/DD/YYYY hh:mm:ss A');

        if (moduleIndex !== -1) {
          const newModules = [];
          modules?.forEach((module, index) => {
            let newModule = module;
            if (index === moduleIndex) {
              newModule = { ...newModule, testNodes: testNodeIds, testCaseIDs };
            }
            newModules.push(newModule);
          });
          data.modules = newModules;
        } else {
          const modulesObj = [];
          modules?.forEach((module) => {
            modulesObj.push(module);
          });
          modulesObj.push(moduleObj);
          data.modules = modulesObj;
        }
        setReleaseData(dispatch, data);
      } else {
        const formData = {};
        formData.projectID = currentProject._id;
        formData.releaseName = values.name;
        formData.description = values.description;
        formData.version = values.version;
        formData.releaseVersion = values.version;
        formData.releaseDate = moment(values.releaseDate).format('MM/DD/YYYY hh:mm:ss A');
        formData.schedule = values.schedule || RELEASE_SCHEDULE.NO_REPEAT;
        formData.scheduledOn = releaseData?.scheduledOn;
        formData.modules = [moduleObj];
        setReleaseData(dispatch, formData);
      }

      if (module._id && releaseData?.modules) {
        const mids = releaseData?.modules?.map((m) => m.moduleID);
        mids.push(module._id);
        const modules = moduleList?.filter((m) => !mids.includes(m._id));
        setFilteredModuleList(dispatch, modules);
      }

      setTags([]);
      setPriority([]);
      setTestCaseIDs(null);
      setSelectedTestCases(null);
      setExecutionData(null);
      setOpenAddProject(false);
      setDependsOn(null);
    }
  };

  const addRemoveMultiModulesToRelease = (mIds) => {
    const selectedModules = moduleList?.filter((m) => mIds?.includes(m._id));

    let modulesObj = [];
    let formData = {};

    selectedModules.forEach((module) => {
      const testNodeIds = [];
      const testCaseIDs = [];

      module?.testNodes?.forEach((testCase) => {
        testNodeIds.push(testCase?._id);
        testCaseIDs.push(`${testCase.testNode[0].testCaseID} - ${testCase.testNode[0].testCaseTitle}`);
      });

      const moduleObj = {
        name: module.suiteName,
        moduleID: module._id,
        testNodes: testNodeIds,
        testCaseIDs: testCaseIDs,
        tags: values.tags,
        dependsOn: dependsOn,
        testPlaceholders: module.testPlaceholders
      };
      modulesObj.push(moduleObj);
    });

    formData.projectID = currentProject._id;
    formData.releaseName = values.name;
    formData.description = values.description;
    formData.version = values.version;
    formData.releaseVersion = values.version;
    formData.releaseDate = moment(values.releaseDate).format('MM/DD/YYYY hh:mm:ss A');
    formData.schedule = values.schedule || RELEASE_SCHEDULE.NO_REPEAT;
    formData.scheduledOn = releaseData?.scheduledOn;
    formData.multiModuleSelection = values.multiModuleSelection;
    formData.modules = modulesObj;
    formData.moduleIDs = mIds;
    setReleaseData(dispatch, formData);
  };

  const handleRemoveModule = (index) => {
    const { modules } = releaseData;
    let newModules = [];

    let deletedModule = modules?.[index];

    newModules = modules.filter((m, i) => i !== index);

    const deletedName = deletedModule?.name; // e.g. "SalesOrder"

    const hasSamePlaceholder = newModules.some((mod) => {
      const placeholdersArray = mod.testPlaceholders || [];

      return placeholdersArray.some((phObj) => {
        return Object.values(phObj).some((val) => {
          return typeof val === 'string' && val.includes(deletedName + ' -');
        });
      });
    });

    if (hasSamePlaceholder) {
      setCanDeleteRelease(hasSamePlaceholder);
      const moduleNames = newModules
        .filter((mod) => {
          const placeholdersArray = mod.testPlaceholders || [];

          return placeholdersArray.some((phObj) =>
            Object.values(phObj).some((val) => typeof val === 'string' && val.includes(deletedName + ' -'))
          );
        })
        .map((mod) => mod.name);
      setModuleNames(moduleNames);
    } else {
      modules?.forEach((module, moduleIndex) => {
        if (index === moduleIndex) {
          setOutputVariables(outputVariables.filter((item) => !item.toLowerCase().includes(module.name.toLowerCase())));
        }
      });
      const data = { ...releaseData, modules: newModules };
      if (newModules) {
        const mids = newModules?.map((m) => m.moduleID);
        const modules = moduleList?.filter((m) => !mids.includes(m._id));
        setFilteredModuleList(dispatch, modules);
      }
      setReleaseData(dispatch, data);
    }
  };

  const handleTestCaseIdsChange = (event, newValue) => {
    newValue = event.target.value;
    // if (newValue[newValue.length - 1] === 'All') {
    if (newValue === 'All') {
      setSelectedTestCases(testCaseIDs);
    }
    // else if (
    //   selectedTestCases.find((current) => current === 'All') &&
    //   newValue
    //   !newValue?.find((current) => current === 'All')
    // ) {
    //   console.log('else if');
    //   setSelectedTestCases([]);
    // }
    else if (selectedTestCases.includes(newValue))
      setSelectedTestCases(selectedTestCases.filter((item) => item !== newValue));
    else if (!selectedTestCases.includes(newValue)) setSelectedTestCases([...selectedTestCases, newValue]);
  };

  const handleReleaseCancel = async () => {
    setReleaseData(dispatch, null);
    navigateToLink(PATH_DASHBOARD.release.allReleases);
  };

  const handleEditClose = (saveChanges) => {
    setEdit(false);
    if (!saveChanges) {
      const index = Number(testDataToEdit?.index);
      // setExecutionDataWithOV((prev) => prev.map((item, i) => (i === index ? prevTestDataToEdit : item)));

      setExecutionDataWithOV((prev) => prev.map((item, i) => (i === index ? prevTestDataToEditWithOV : item)));

      setExecutionData((prev) => prev.map((item, i) => (i === index ? prevTestDataToEdit : item)));

      setPrevTestDataToEdit([]);
      setPrevTestDataToEditWithOV([]);
    }
  };

  const handleSetExecutionDataWithOV = (moduleId, accordion) => {
    if (releaseData) {
      const module = releaseData?.modules?.find((module) => module.moduleID === moduleId);
      const testPlaceholders = module?.testPlaceholders;
      const testPlaceholdersWithOV = [];
      const apiRequestFiles = currentProject?.requestFiles?.map((apiRequestFile) => {
        return `api - ${apiRequestFile?.apiRequestName}`;
      });
      testPlaceholders?.forEach((testPlaceholders) => {
        const keys = Object.keys(testPlaceholders);
        const newTps = {};

        keys.forEach((key) => {
          let value = null;
          if (apiRequestFiles) value = [testPlaceholders[key], ...outputVariables, ...apiRequestFiles];
          else value = [testPlaceholders[key], ...outputVariables];
          newTps[key] = value;
        });

        // testPlaceholdersWithOV.push(newTps);

        testPlaceholdersWithOV.push(newTps);
      });

      setExecutionDataWithOV(testPlaceholdersWithOV);
      setExecutionData(testPlaceholders);
    }
  };

  const handleEdit = (testData, index, moduleId) => {
    setTestDataToEdit({ testData, index, moduleId });
    setPrevTestDataToEdit(executionData[index]);
    setPrevTestDataToEditWithOV(executionDataWithOV[index]);
  };

  const saveTestData = (e) => {
    e.preventDefault();
    const $executionData = [...executionData];
    $executionData[updatedTestData?.index] = updatedTestData?.testData;
    setExecutionData($executionData);
  };

  const handleEditTestData = async (e) => {
    const { name, value } = e.target;
    const $testData = { ...testDataToEdit?.testData };
    $testData[name] = value;
    setUpdatedTestData({ index: testDataToEdit?.index, testData: $testData });
  };

  useEffect(() => {
    dispatch(getModuleList(true, false));
    getReleaseList();
  }, [dispatch, getReleaseList]);

  useEffect(() => {
    if (currentRelease && isEdit) getReleaseToEdit(currentRelease?._id);
  }, [currentRelease, isEdit, getReleaseToEdit]);

  useEffect(() => {
    if (processBPData) getBusinessProcessTags();
  }, [processBPData, getBusinessProcessTags]);

  useEffect(() => {
    if (releaseData) {
      // existing logic
      setMultiModuleSelect(releaseData.multiModuleSelection === 'Modules Only');

      // new logic: pre-populate moduleIDs if available
      if (releaseData.moduleIDs?.length && moduleList?.length) {
        setFieldValue(
          'moduleIDs',
          releaseData.moduleIDs // backend module IDs
        );
      }
    }
  }, [releaseData, moduleList, setFieldValue]);

  // filter list based on search
  // const filteredModules = moduleList?.filter((m) => m.suiteName.toLowerCase().includes(search.toLowerCase()));

  const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
  const checkedIcon = <CheckBoxIcon fontSize="small" />;

  const allOption = { _id: 'all', suiteName: 'Select All' };

  // const safeModuleList = Array.isArray(moduleList) ? moduleList : [];
  // const displayedOptions =
  //   search.trim() === ''
  //     ? [allOption, ...moduleList]
  //     : moduleList?.filter((m) => m.suiteName.toLowerCase().includes(search.toLowerCase()));

  const handleExecutionDataEdit = (event, moduleId) => {
    setExecutionDataEdit((prev) => !prev);
    // setModuleDataEdit((prev) =>
    //   Object.fromEntries(Object.keys(prev).map((id) => [id, id === moduleId ? !prev[id] : false]))
    // );
    setModuleDataEdit((prev) => {
      let state = prev;

      if (!prev || Object.keys(prev).length === 0) {
        state = {};
        releaseData?.modules?.forEach((m) => {
          state[m.moduleID] = false;
        });
      }

      const updated = {};
      Object.keys(state).forEach((key) => {
        updated[key] = key === moduleId ? !state[key] : false;
      });

      const anyTrue = Object.values(updated || {}).some((v) => v === true);
      setSaveRelease(anyTrue);

      return updated;
    });
  };

  const handleTestPlaceholdersChange = async (event, moduleId, key) => {
    const { value } = event.target;
    const updatedModules = releaseData.modules.map((module) => {
      if (module.moduleID === moduleId) {
        const updatedTestPlaceholders = module.testPlaceholders.map((tp) => ({
          ...tp,
          [key]: value
        }));

        return {
          ...module,
          testPlaceholders: updatedTestPlaceholders
        };
      }
      return module;
    });

    setReleaseData(dispatch, {
      ...releaseData,
      modules: updatedModules
    });
  };

  const isSingleRow = (testData) => {
    if (testData[0]) {
      return Object.keys(testData[0])[0] === 'key';
    }
    return null;
  };

  const prepareTestData = (testData) => {
    const testCases = [];
    const testCase = {};
    testData.forEach((member) => {
      const key = member?.key;
      const value = member?.value;
      testCase[key] = value;
    });
    testCases.push(testCase);
    return testCases;
  };

  const handleFileChange = (event, moduleId) => {
    const file = event.target.files[0];
    if (file) {
      const fileName = file.name;
      if (fileName.includes('.xls') || fileName.includes('.xlsx')) {
        const reader = new FileReader();
        reader.readAsText(file);
        let isValid;
        reader.onload = async () => {
          const f = await file.arrayBuffer();
          const wb = XLSX.read(f, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]]; // get the first worksheet
          const testData = XLSX.utils.sheet_to_json(ws);
          if (!testData || testData?.length === 0) {
            enqueueSnackbar('Empty File Uploaded. Please upload valid Test data file!!', { variant: 'error' });
          } else {
            isValid = true;
          }
          if (isValid) {
            setModuleDataEdit((prev) => Object.fromEntries(Object.keys(prev).map((key) => [key, true])));
            setSaveRelease(false);
            setTestDataToEdit({});
            const isSingle = isSingleRow(testData);
            if (isSingle) {
              const updatedTestData = prepareTestData(testData);
              // setExtractedTestData({ fileName, data: updatedTestData });
              if (updatedTestData && releaseData) {
                const updatedModules = releaseData.modules.map((module) => {
                  if (module.moduleID === moduleId) {
                    const updatedTestPlaceholders = updatedTestData;

                    return {
                      ...module,
                      testPlaceholders: updatedTestPlaceholders
                    };
                  }
                  return module;
                });

                setReleaseData(dispatch, {
                  ...releaseData,
                  modules: updatedModules
                });
              }
              if (updatedTestData && executionDataWithOV) {
                const testPlaceholdersWithOV = [];
                const apiRequestFiles = currentProject?.requestFiles?.map((apiRequestFile) => {
                  return `api - ${apiRequestFile?.apiRequestName}`;
                });
                updatedTestData?.forEach((testPlaceholders) => {
                  const keys = Object.keys(testPlaceholders);
                  const newTps = {};

                  keys.forEach((key) => {
                    let value = null;
                    if (apiRequestFiles) value = [testPlaceholders[key], ...outputVariables, ...apiRequestFiles];
                    else value = [testPlaceholders[key], ...outputVariables];
                    newTps[key] = value;
                  });

                  // testPlaceholdersWithOV.push(newTps);

                  testPlaceholdersWithOV.push(newTps);
                });

                setExecutionDataWithOV(testPlaceholdersWithOV);
                setExecutionData(updatedTestData);
              }
            } else {
              // setExtractedTestData({ fileName, data: testData });
              // enqueueSnackbar('Unable to process the file', { variant: 'error' });

              if (testData && releaseData) {
                const updatedModules = releaseData.modules.map((module) => {
                  if (module.moduleID === moduleId) {
                    const updatedTestPlaceholders = testData;

                    return {
                      ...module,
                      testPlaceholders: updatedTestPlaceholders
                    };
                  }
                  return module;
                });

                setReleaseData(dispatch, {
                  ...releaseData,
                  modules: updatedModules
                });
              }
              if (testData && executionDataWithOV) {
                const testPlaceholdersWithOV = [];
                const apiRequestFiles = currentProject?.requestFiles?.map((apiRequestFile) => {
                  return `api - ${apiRequestFile?.apiRequestName}`;
                });
                testData?.forEach((testPlaceholders) => {
                  const keys = Object.keys(testPlaceholders);
                  const newTps = {};

                  keys.forEach((key) => {
                    let value = null;
                    if (apiRequestFiles) value = [testPlaceholders[key], ...outputVariables, ...apiRequestFiles];
                    else value = [testPlaceholders[key], ...outputVariables];
                    newTps[key] = value;
                  });

                  // testPlaceholdersWithOV.push(newTps);

                  testPlaceholdersWithOV.push(newTps);
                });

                setExecutionDataWithOV(testPlaceholdersWithOV);
                setExecutionData(testData);
              }
            }
          } else {
            enqueueSnackbar('Uploaded invalid test data file', { variant: 'error' });
          }
        };
      } else {
        // setMessage('Test Data File type should be JSON or Excel');
        enqueueSnackbar('Test Data File type should be JSON or Excel', { variant: 'error' });
      }
    }
  };

  return (
    <>
      <FormikProvider value={formik}>
        <Form noValidate autoComplete="off" onSubmit={handleSubmit}>
          <Grid container>
            <Grid item xs={12} md={12}>
              <Card sx={{ p: 3 }} style={{ boxShadow: '0 0 10px #919eab' }}>
                <Stack spacing={3}>
                  <LabelStyle>Release Details</LabelStyle>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={{ xs: 3, sm: 2 }}
                    style={{ marginTop: '15px' }}
                  >
                    <TextField
                      // fullWidth
                      sx={{ flex: 2 }}
                      label="Release Name"
                      size="small"
                      value={releaseData?.releaseName}
                      {...getFieldProps('name')}
                      onChange={handleReleaseNameChange}
                      error={Boolean(touched.name && errors.name)}
                      helperText={touched.name && errors.name}
                      disabled={isEdit}
                    />
                    <TextField
                      // fullWidth
                      sx={{ flex: 1.5 }}
                      label="Release Version"
                      size="small"
                      placeholder="Release Version"
                      SelectProps={{ native: true }}
                      {...getFieldProps('version')}
                      onChange={handleReleaseVersionChange}
                      error={Boolean(touched.version && errors.version)}
                      helperText={touched.version && errors.version}
                    />
                    <DesktopDatePicker
                      renderInput={(props) => (
                        <TextField
                          {...props}
                          // fullWidth
                          sx={{ flex: 1.2 }}
                          size="small"
                          error={Boolean(touched.releaseDate && errors.releaseDate)}
                          helperText={touched.releaseDate && errors.releaseDate}
                        />
                      )}
                      label="Release Date"
                      format="MM/dd/yyyy"
                      {...getFieldProps('releaseDate')}
                      value={getDateValue(values.releaseDate)}
                      // minDate={values.date}
                      minDate={
                        isEdit && values.releaseDate
                          ? values.releaseDate // editing → cannot select before saved release date
                          : new Date() // creating → cannot select before today
                      }
                      onChange={handleReleaseDateChange}
                      disabled={isEdit}
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                    <TextField
                      size="small"
                      fullWidth
                      label="Release Description"
                      {...getFieldProps('description')}
                      onChange={handleReleaseDescChange}
                      error={Boolean(touched.description && errors.description)}
                      helperText={touched.description && errors.description}
                    />
                    <div style={{ display: 'flex', width: '100%' }}>
                      <span style={{ marginRight: '10px', marginTop: '8px' }}>Schedule:</span>
                      <RadioGroup
                        row
                        aria-label="schedule"
                        name="schedule"
                        size="small"
                        onChange={async (event) => {
                          const errors = await formik.validateForm();
                          if (event.target.value === RELEASE_SCHEDULE.WEEKLY) {
                            const nerrors = { ...errors };
                            delete nerrors.scheduleDay;
                            formik.setErrors(nerrors);
                          }
                          if (
                            Object.keys(errors).length === 0 ||
                            (Object.keys(errors).length === 1 && !Object.keys(errors).includes('name'))
                          ) {
                            const schedule = event.target.value;
                            const data = { ...releaseData, schedule };
                            setFieldValue('schedule', schedule);
                            setReleaseSchedule(schedule);
                            setReleaseData(dispatch, data);
                            if (schedule === RELEASE_SCHEDULE.NO_REPEAT) setShowSchedule(false);
                            else {
                              setFieldValue('schedule', schedule);
                              setShowSchedule(true);
                              // handleScheduleStartChange();
                              setFieldValue(
                                'scheduleStart',
                                values.scheduleStart || releaseData?.scheduledOn?.scheduleStart || new Date()
                              );
                              setFieldValue(
                                'scheduleEnd',
                                values.scheduleEnd || releaseData?.scheduledOn?.scheduleEnd || new Date()
                              );
                              setOpenAddProject(false);
                              const { scheduledOn } = releaseData;
                              if (scheduledOn) {
                                const data = { ...scheduledOn };
                                if (event.target.value === RELEASE_SCHEDULE.DAILY) {
                                  setFieldValue('weekDay', '');
                                  setFieldValue('scheduleDay', '');
                                  delete data.weekDay;
                                  delete data.monthDay;
                                  setReleaseData(dispatch, {
                                    ...releaseData,
                                    schedule,
                                    scheduledOn: data
                                  });
                                } else if (event.target.value === RELEASE_SCHEDULE.WEEKLY) {
                                  setFieldValue('scheduleDay', '');
                                  delete data.monthDay;
                                  setReleaseData(dispatch, {
                                    ...releaseData,
                                    schedule,
                                    scheduledOn: data
                                  });
                                } else if (event.target.value === RELEASE_SCHEDULE.MONTHLY) {
                                  setFieldValue('weekDay', '');
                                  delete data.weekDay;
                                  setReleaseData(dispatch, {
                                    ...releaseData,
                                    schedule,
                                    scheduledOn: data
                                  });
                                }
                              }
                            }
                          } else {
                            formik.setTouched(setNestedObjectValues(errors, true));
                            setFieldValue('schedule', RELEASE_SCHEDULE.NO_REPEAT);
                          }
                        }}
                        value={releaseData?.schedule || releaseSchedule || RELEASE_SCHEDULE.NO_REPEAT}
                      >
                        <FormControlLabel value="No Repeat" control={<Radio size="small" />} label="No Repeat" />
                        <FormControlLabel value="Daily" control={<Radio size="small" />} label="Daily" />
                        <FormControlLabel value="Weekly" control={<Radio size="small" />} label="Weekly" />
                        <FormControlLabel value="Monthly" control={<Radio selected size="small" />} label="Monthly" />
                      </RadioGroup>
                    </div>
                  </Stack>

                  {showSchedule && (
                    <>
                      <Stack direction="row">
                        <Stack style={{ width: '40%', paddingRight: '20px' }}>
                          <DesktopDatePicker
                            renderInput={(props) => (
                              <TextField
                                {...props}
                                size="small"
                                error={Boolean(touched.scheduleStart && errors.scheduleStart)}
                                helperText={touched.scheduleStart && errors.scheduleStart}
                              />
                            )}
                            label="Start"
                            format="MM/dd/yyyy"
                            minDate={
                              isEdit && values.scheduleStart
                                ? values.scheduleStart // editing → cannot select before saved release date
                                : new Date() // creating → cannot select before today
                            }
                            {...getFieldProps('scheduleStart')}
                            value={getDateValue(values.scheduleStart) || releaseData?.scheduledOn?.scheduleStart}
                            // minDate={values.date}
                            onChange={handleScheduleStartChange}
                          />
                        </Stack>
                        <Stack style={{ width: '40%', paddingRight: '20px' }}>
                          <DesktopDatePicker
                            renderInput={(props) => (
                              <TextField
                                {...props}
                                size="small"
                                error={Boolean(touched.scheduleEnd && errors.scheduleEnd)}
                                helperText={touched.scheduleEnd && errors.scheduleEnd}
                              />
                            )}
                            label="End"
                            format="MM/dd/yyyy"
                            minDate={
                              isEdit && values.scheduleEnd
                                ? values.scheduleEnd // editing → cannot select before saved release date
                                : new Date() // creating → cannot select before today
                            }
                            {...getFieldProps('scheduleEnd')}
                            value={getDateValue(values.scheduleEnd) || releaseData?.scheduledOn?.scheduleEnd}
                            // minDate={values.date}
                            onChange={handleScheduleEndChange}
                          />
                        </Stack>

                        {values.schedule === RELEASE_SCHEDULE.WEEKLY && (
                          <TextField
                            select
                            size="small"
                            style={{ width: '40%', paddingRight: '20px' }}
                            label="Week Day"
                            value={values.weekDay}
                            {...getFieldProps('weekDay')}
                            SelectProps={{ native: true }}
                            onChange={handleScheduleWeekDayChange}
                            onClick={handleScheduleWeekDayChange}
                            error={Boolean(touched.weekDay && errors.weekDay)}
                            helperText={touched.weekDay && errors.weekDay}
                          >
                            <option value="" />
                            {WEEK_DAYS &&
                              WEEK_DAYS?.map((WEEK_DAY) => (
                                <option key={WEEK_DAY.week} value={WEEK_DAY.week}>
                                  {WEEK_DAY.day}
                                </option>
                              ))}
                          </TextField>
                        )}

                        {values.schedule === RELEASE_SCHEDULE.MONTHLY && (
                          // <DesktopDatePicker
                          //   style={{ width: '40%', paddingRight: '20px' }}
                          //   renderInput={(props) => (
                          //     <TextField
                          //       {...props}
                          //       size="small"
                          //       error={Boolean(touched.releaseDate && errors.releaseDate)}
                          //       helperText={touched.releaseDate && errors.releaseDate}
                          //     />
                          //   )}
                          //   label="Schedule Date"
                          //   format="dd-MM-yyyy"
                          //   {...getFieldProps('scheduledate')}
                          //   value={values.releaseDate}
                          //   minDate={values.date}
                          //   onChange={handleReleaseDateChange}
                          //   disabled={values.schedule !== RELEASE_SCHEDULE.MONTHLY}
                          // />
                          <TextField
                            select
                            size="small"
                            style={{ width: '40%', paddingRight: '20px' }}
                            label="Day"
                            value={values.scheduleDay}
                            {...getFieldProps('scheduleDay')}
                            SelectProps={{ native: true }}
                            onChange={handleScheduleDayChange}
                            error={Boolean(touched.scheduleDay && errors.scheduleDay)}
                            helperText={touched.scheduleDay && errors.scheduleDay}
                          >
                            <option value="" />
                            {MONTHS &&
                              MONTHS?.map((MONTH) => (
                                <option key={MONTH} value={MONTH}>
                                  {MONTH}
                                </option>
                              ))}
                          </TextField>
                        )}
                        <Stack style={{ width: '40%', paddingLeft: '20px' }}>
                          <MobileTimePicker
                            orientation="portrait"
                            label="Hours and Minutes"
                            value={value ? new Date(value) : null}
                            onChange={(newValue) => {
                              handleScheduleTimeChange(newValue);
                            }}
                            renderInput={(params) => <TextField {...params} size="small" fullWidth />}
                          />
                        </Stack>
                      </Stack>
                    </>
                  )}

                  {/* {businessProcessTags?.length !== 0 && ( */}
                  {!multiModuleSelect && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                      <Autocomplete
                        multiple
                        freeSolo
                        fullWidth
                        size="small"
                        // defaultValue={businessProcessTags}
                        value={values.businessProcessTags}
                        onChange={handleBusinessProcessTagsChange}
                        options={businessProcessTags}
                        disableCloseOnSelect
                        getOptionLabel={(option) => option}
                        renderOption={(props, option, { selected }) => (
                          <li {...props}>
                            <Checkbox
                              icon={icon}
                              checkedIcon={checkedIcon}
                              style={{ marginRight: 8 }}
                              checked={selected}
                            />
                            {option}
                          </li>
                        )}
                        renderInput={(params) => <TextField {...params} label="Business Process" />}
                      />
                    </Stack>
                  )}

                  {/* )} */}
                  <div style={{ display: 'flex', width: '100%' }}>
                    <span style={{ marginRight: '10px', marginTop: '8px' }}>Selection of Modules:</span>
                    <RadioGroup
                      row
                      aria-label="multiModuleSelection"
                      name="multiModuleSelection"
                      size="small"
                      value={formik.values.multiModuleSelection || ''}
                      onChange={async (event) => {
                        const errors = await formik.validateForm();
                        if (Object.keys(errors).length === 0) {
                          const value = event.target.value;
                          formik.setFieldValue('multiModuleSelection', value);

                          // Optional: mark as touched for validation
                          // formik.setFieldTouched('multiModuleSelection', true);

                          // If you need to update releaseData as well
                          setReleaseData(dispatch, {
                            ...releaseData,
                            multiModuleSelection: value
                          });
                          // You can add additional logic based on selection
                          if (value === 'Modules with Details') {
                            setMultiModuleSelect(false);
                          } else {
                            setMultiModuleSelect(true);
                          }
                        } else {
                          formik.setTouched(setNestedObjectValues(errors, true));
                          setFieldValue('multiModuleSelection', 'Modules with Details');
                          setMultiModuleSelect(false);
                        }
                      }}
                    >
                      <FormControlLabel
                        value="Modules with Details"
                        control={<Radio size="small" />}
                        label="Modules with additional details"
                        disabled={isEdit}
                      />
                      <FormControlLabel
                        value="Modules Only"
                        control={<Radio size="small" />}
                        label="Only Modules"
                        disabled={isEdit}
                      />
                    </RadioGroup>
                  </div>
                  {multiModuleSelect && moduleList?.length > 0 && (
                    <Autocomplete
                      multiple
                      disableCloseOnSelect
                      options={[allOption, ...(moduleList || [])]}
                      // value={moduleList?.filter((m) => values.moduleIDs?.includes(m._id))}
                      value={moduleList?.filter((m) => values.moduleIDs?.map(String).includes(String(m._id))) || []}
                      onChange={(e, newValue, reason, details) => {
                        if (reason === 'clear') {
                          // user clicked the clear-all "x"
                          setFieldValue('moduleIDs', []);
                          return;
                        }
                        if (!details) return;

                        let updatedModules = [];

                        if (details.option?._id === 'all') {
                          if (values.moduleIDs?.length === moduleList?.length) {
                            // unselect all
                            updatedModules = [];
                          } else {
                            // select all
                            updatedModules = moduleList.map((m) => m._id);
                          }
                        } else {
                          // normal selection
                          updatedModules = newValue.map((m) => m._id);
                        }
                        setFieldValue('moduleIDs', updatedModules);
                        setReleaseData(dispatch, {
                          ...releaseData,
                          moduleIDs: updatedModules
                        });
                        addRemoveMultiModulesToRelease(updatedModules);
                      }}
                      getOptionLabel={(option) => option.suiteName}
                      renderOption={(props, option, { selected }) => {
                        if (option._id === 'all') {
                          const allSelected = values.moduleIDs?.length === moduleList?.length;
                          const indeterminate =
                            values.moduleIDs?.length > 0 && values.moduleIDs?.length < moduleList?.length;

                          return (
                            <li {...props}>
                              <Checkbox
                                indeterminate={indeterminate}
                                icon={icon}
                                checkedIcon={checkedIcon}
                                checked={allSelected}
                                style={{ marginRight: 8 }}
                              />
                              {option.suiteName}
                            </li>
                          );
                        }

                        return (
                          <li {...props}>
                            <Checkbox
                              icon={icon}
                              checkedIcon={checkedIcon}
                              style={{ marginRight: 8 }}
                              checked={selected}
                            />
                            {option.suiteName}
                          </li>
                        );
                      }}
                      renderTags={(selected, getTagProps) =>
                        selected.map((option, index) => (
                          <Chip key={option._id} label={option.suiteName} {...getTagProps({ index })} />
                        ))
                      }
                      renderInput={(params) => <TextField {...params} size="small" label="Modules" />}
                    />
                  )}
                  {multiModuleSelect && values.moduleIDs?.length > 0 && (
                    <Grid item xs={12} md={12} style={{ marginTop: '1.5rem' }}>
                      <Stack
                        justifyContent="center"
                        alignItems="center"
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={{ xs: 3, sm: 2 }}
                      >
                        <Button variant="outlined" onClick={handleReleaseCancel}>
                          Cancel
                        </Button>
                        <Button variant="contained" type="submit" disabled={isSubmitting}>
                          {isEdit ? (
                            <>
                              <ModeEditOutlineIcon />
                              Update
                            </>
                          ) : (
                            <>Create</>
                          )}
                        </Button>
                      </Stack>
                    </Grid>
                  )}
                </Stack>
              </Card>
            </Grid>

            {!openAddProject && !multiModuleSelect && (
              <Grid item xs={12} md={12}>
                <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                  <Button
                    variant="outlined"
                    startIcon={<Icon icon={plusFill} />}
                    onClick={() => {
                      handleAddProjectView();
                      setBusinessProcess(false);
                      setFilteredBPModuleList(dispatch, null);
                    }}
                  >
                    Add Module
                  </Button>
                  {businessProcessTags?.length !== 0 && (
                    <Button
                      variant="outlined"
                      startIcon={<Icon icon={plusFill} />}
                      onClick={() => {
                        handleBusinessProcessView();
                        setBusinessProcess(true);
                      }}
                    >
                      Retrieve Modules
                    </Button>
                  )}
                </Stack>
              </Grid>
            )}
            {openAddProject && !multiModuleSelect && (
              <FormikProvider value={addProjectFormik}>
                <Grid item xs={12} md={12} style={{ marginTop: '1rem' }}>
                  <Card sx={{ p: 3 }} style={{ boxShadow: '0 0 10px #919eab', marginTop: '1rem' }}>
                    <Stack spacing={3}>
                      <LabelStyle style={{ color: '#637381' }}>Select Module</LabelStyle>
                      {/* {businessProcess && (
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                          <Autocomplete
                            multiple
                            freeSolo
                            fullWidth
                            size="small"
                            // defaultValue={businessProcessTags}
                            value={values.businessProcessTags}
                            onChange={handleBusinessProcessTagsChange}
                            options={businessProcessTags}
                            disableCloseOnSelect
                            getOptionLabel={(option) => option}
                            renderOption={(props, option, { selected }) => (
                              <li {...props}>
                                <Checkbox
                                  icon={icon}
                                  checkedIcon={checkedIcon}
                                  style={{ marginRight: 8 }}
                                  checked={selected}
                                />
                                {option}
                              </li>
                            )}
                            renderInput={(params) => <TextField {...params} label="Business Process" />}
                          />
                        </Stack>
                      )} */}
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                        {businessProcess}
                        <TextField
                          select
                          fullWidth
                          size="small"
                          label="Modules"
                          value={values.moduleIds}
                          placeholder="Select Module"
                          id="module"
                          SelectProps={{ native: true }}
                          onChange={handleModulesChange}
                          error={Boolean(addProjectFormik.touched.moduleIds && addProjectFormik.errors.moduleIds)}
                          helperText={addProjectFormik.touched.moduleIds && addProjectFormik.errors.moduleIds}
                        >
                          <option value="" />
                          {moduleList &&
                            // !filteredBPModuleList &&
                            !businessProcess &&
                            filteredModuleList?.map((module) => (
                              <option key={module._id} value={module._id}>
                                {module.suiteName}
                              </option>
                            ))}

                          {moduleList &&
                            // filteredBPModuleList &&
                            businessProcess &&
                            filteredBPModuleList.map((module) => (
                              <option key={module._id} value={module._id}>
                                {module.suiteName}
                              </option>
                            ))}
                        </TextField>
                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                        <Autocomplete
                          multiple
                          freeSolo
                          fullWidth
                          size="small"
                          defaultValue={tags}
                          value={values.tags}
                          onChange={handleTagsChange}
                          options={tags}
                          disableCloseOnSelect
                          getOptionLabel={(option) => option}
                          renderOption={(props, option, { selected }) => (
                            <li {...props}>
                              <Checkbox
                                icon={icon}
                                checkedIcon={checkedIcon}
                                style={{ marginRight: 8 }}
                                checked={selected}
                              />
                              {option}
                            </li>
                          )}
                          renderInput={(params) => <TextField {...params} label="Tags" />}
                        />
                        <Autocomplete
                          multiple
                          freeSolo
                          size="small"
                          fullWidth
                          value={values.priority}
                          onChange={handlePriorityChange}
                          options={priority?.map((option) => option)}
                          disableCloseOnSelect
                          getOptionLabel={(option) => option}
                          renderOption={(props, option, { selected }) => (
                            <li {...props}>
                              <Checkbox
                                icon={icon}
                                checkedIcon={checkedIcon}
                                style={{ marginRight: 8 }}
                                checked={selected}
                              />
                              {option}
                            </li>
                          )}
                          renderInput={(params) => <TextField {...params} label="Priority" />}
                        />
                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                        {testCaseIDs?.length > 0 && (
                          <Grid item xs={12} md={12} style={{ marginTop: '1rem' }}>
                            <Autocomplete
                              multiple
                              size="small"
                              renderTags={() => {
                                // const selectedCasesCount = value.filter((item) => item !== 'All').length;
                                let selectedCasesCount = selectedTestCases?.length;
                                if (selectedTestCases?.includes('All')) selectedCasesCount -= 1;
                                return (
                                  <span
                                    style={{
                                      paddingLeft: '5px'
                                    }}
                                  >
                                    {' '}
                                    {selectedCasesCount < 0 ? 0 : selectedCasesCount} Testcase(s) selected
                                  </span>
                                );
                              }}
                              value={testCaseIDs}
                              // onChange={handleTestCaseIdsChange}
                              options={testCaseIDs && testCaseIDs?.map((option) => option)}
                              disableCloseOnSelect
                              getOptionLabel={(option) => option}
                              renderOption={(props, option) => (
                                <>
                                  <li {...props}>
                                    <Checkbox
                                      indeterminate={
                                        option === 'All'
                                          ? selectedTestCases.length > 0 &&
                                            selectedTestCases.length < testCaseIDs?.length
                                          : false
                                      }
                                      icon={icon}
                                      checkedIcon={checkedIcon}
                                      style={{ marginRight: 8 }}
                                      checked={selectedTestCases?.includes(option)}
                                      value={option}
                                      onChange={handleTestCaseIdsChange}
                                    />
                                    {option}
                                  </li>
                                </>
                              )}
                              renderInput={(params) => <TextField {...params} label="Test Cases" />}
                            />
                          </Grid>
                        )}
                      </Stack>
                    </Stack>
                    {executionData && executionData?.length !== 0 && !multiModuleSelect && (
                      <Stack spacing={3}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                          <Grid item xs={12} md={12} style={{ marginTop: '2rem' }}>
                            <Card style={{ boxShadow: '0 0 10px #919eab' }}>
                              <CardHeader
                                title="Execution Data"
                                action={
                                  // isEdit && (
                                  <Stack direction="row" spacing={1}>
                                    <input
                                      accept=".xls,.xlsx"
                                      id="upload-file"
                                      type="file"
                                      style={{ display: 'none' }}
                                      onChange={(event) => {
                                        handleFileChange(event, module._id);
                                      }}
                                    />
                                    <label htmlFor="upload-file">
                                      <Button variant="contained" size="small" component="span">
                                        Upload File
                                      </Button>
                                    </label>
                                  </Stack>
                                  // )
                                }
                                sx={{ mb: 3 }}
                              />
                              <Scrollbar>
                                {executionData && executionData?.length === 1 && (
                                  <TableContainer sx={{ maxHeight: 300 }}>
                                    <Table>
                                      <TableHead>
                                        <TableRow>
                                          <TableCell>Key/Placeholder</TableCell>
                                          <TableCell>Value</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {Object.keys(executionData[0]) &&
                                          Object.keys(executionData[0]).map((key) => (
                                            <TableRow key={key}>
                                              <TableCell>{key}</TableCell>
                                              <TableCell>
                                                {EXCLUDE_KEYS.includes(key) && (
                                                  <TextField
                                                    required
                                                    type={key === 'password' ? 'password' : 'text'}
                                                    id={key}
                                                    defaultValue={executionData[0][key]}
                                                    value={executionData[0][key]}
                                                    style={{ height: '2rem', width: '50%' }}
                                                    SelectProps={{ native: true }}
                                                    onChange={(event) => {
                                                      handleSingleRowExecutionDataChange(event, key);
                                                    }}
                                                  />
                                                )}
                                                {!EXCLUDE_KEYS.includes(key) && (
                                                  <Autocomplete
                                                    value={executionDataWithOV[0][key][0]}
                                                    onChange={(event, newValue) => {
                                                      try {
                                                        newValue = newValue.replace(/["]/g, '').replace('Add ', '');
                                                        handleExecutionDataWithOVChange(event, key, newValue);
                                                      } catch (error) {
                                                        //
                                                      }
                                                    }}
                                                    filterOptions={(options, params) => {
                                                      try {
                                                        const filtered = filter(options, params);

                                                        const { inputValue } = params;
                                                        // Suggest the creation of a new value
                                                        const isExisting = options.some(
                                                          (option) => inputValue === option
                                                        );
                                                        if (inputValue !== '' && !isExisting) {
                                                          filtered.push(`Add "${inputValue}"`);
                                                        }

                                                        return filtered;
                                                      } catch (error) {
                                                        //
                                                      }
                                                      return null;
                                                    }}
                                                    selectOnFocus
                                                    clearOnBlur
                                                    handleHomeEndKeys
                                                    id="free-solo-with-text-demo"
                                                    options={executionDataWithOV[0][key]}
                                                    getOptionLabel={(option) => {
                                                      try {
                                                        // Value selected with enter, right from the input
                                                        if (typeof option === 'string') {
                                                          return option;
                                                        }
                                                        // Add "xxx" option created dynamically
                                                        if (option.inputValue) {
                                                          return option;
                                                        }
                                                        // Regular option
                                                        return option;
                                                      } catch (error) {
                                                        console.log('error', error);
                                                      }
                                                      return null;
                                                    }}
                                                    renderOption={(props, option) => {
                                                      // eslint-disable-next-line
                                                      const { key, ...optionProps } = props;
                                                      return (
                                                        <li key={key} {...optionProps}>
                                                          {option}
                                                        </li>
                                                      );
                                                    }}
                                                    sx={{ width: 300 }}
                                                    freeSolo
                                                    renderInput={(params) => <TextField {...params} />}
                                                  />
                                                )}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                      </TableBody>
                                    </Table>
                                  </TableContainer>
                                )}
                                {executionData && executionData?.length > 1 && (
                                  <TableContainer sx={{ minWidth: 480, maxHeight: 300 }}>
                                    <Table stickyHeader>
                                      <TableHead>
                                        {executionData && executionData?.length > 0 && (
                                          <TableRow>
                                            {Object.keys(executionData[0]).map((key) => (
                                              <TableCell key={key}>{key}</TableCell>
                                            ))}
                                            <TableCell>Edit</TableCell>
                                          </TableRow>
                                        )}
                                      </TableHead>
                                      <TableBody>
                                        {executionData.map(
                                          (testData, index) =>
                                            testData &&
                                            tags.length > 0 && (
                                              <TableRow key={index}>
                                                {Object.keys(testData).map((key) => (
                                                  <TableCell key={`${key}${index}`}>
                                                    {key === 'password' ? (
                                                      <TextField
                                                        required
                                                        type={key === 'password' ? 'password' : 'text'}
                                                        id={key}
                                                        defaultValue={testData[key]}
                                                        style={{ height: '2rem' }}
                                                        onChange={(event) => {
                                                          handleExecutionDataChange(event, key);
                                                        }}
                                                        inputProps={{ readOnly: true }}
                                                        sx={{
                                                          '& fieldset': { border: 'none' }
                                                        }}
                                                      />
                                                    ) : (
                                                      testData[key]
                                                    )}
                                                  </TableCell>
                                                ))}
                                                <TableCell>
                                                  <Icon
                                                    icon={editFill}
                                                    width={24}
                                                    height={24}
                                                    onClick={() => {
                                                      setEdit(!edit);
                                                      handleEdit(testData, index);
                                                    }}
                                                    cursor="pointer"
                                                  />
                                                </TableCell>
                                              </TableRow>
                                            )
                                        )}
                                      </TableBody>
                                    </Table>
                                  </TableContainer>
                                )}
                              </Scrollbar>
                            </Card>
                          </Grid>
                        </Stack>
                      </Stack>
                    )}
                    <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                      <Button variant="outlined" onClick={handleAddProjectView}>
                        Cancel
                      </Button>
                      <Button variant="contained" onClick={handleAddProjects}>
                        Add
                      </Button>
                    </Stack>
                  </Card>
                </Grid>
              </FormikProvider>
            )}
            {/* {!isLoading && releaseData && releaseData?.modules && releaseData?.modules?.length !== 0 && (
              <Grid item xs={12} md={12} style={{ marginTop: '1.5rem' }}>
                <Stack
                  justifyContent="center"
                  alignItems="center"
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={{ xs: 3, sm: 2 }}
                >
                  <Button variant="outlined" onClick={handleReleaseCancel}>
                    Cancel
                  </Button>
                  <Button variant="contained" type="submit" disabled={isSubmitting}>
                    {isEdit ? (
                      <>
                        <ModeEditOutlineIcon />
                        Update
                      </>
                    ) : (
                      <>Create</>
                    )}
                  </Button>
                </Stack>
              </Grid>
            )} */}
            {!isLoading &&
              releaseData &&
              releaseData?.modules &&
              releaseData?.modules?.length !== 0 &&
              !multiModuleSelect && (
                <Grid item xs={12} md={12} style={{ marginTop: '1rem' }}>
                  <LabelStyle style={{ marginBottom: '1rem' }}>Project Details</LabelStyle>
                  <Scrollbar>
                    <MotionInView variants={varFadeIn}>
                      {releaseData?.modules?.map((accordion, index) => (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'row' }}>
                            <Accordion
                              key={accordion.id}
                              style={{ width: '95%' }}
                              onClick={() => handleSetExecutionDataWithOV(accordion?.moduleID, accordion)}
                            >
                              <AccordionSummary
                                expandIcon={<Icon icon={arrowIosDownwardFill} width={20} height={20} />}
                                style={{
                                  background: 'linear-gradient(to right, #bdc3c7, #2c3e50)',
                                  borderRadius: 4,
                                  marginBottom: '5px'
                                }}
                              >
                                <Typography variant="subtitle1">{accordion.name}</Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                <Stack spacing={3}>
                                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                                    {accordion?.testCaseIDs?.length > 0 && (
                                      <Grid
                                        item
                                        xs={12}
                                        md={accordion?.testPlaceholders?.length > 0 ? 6 : 12}
                                        style={{ marginTop: '1rem' }}
                                      >
                                        <Card style={{ boxShadow: '0 0 10px #919eab' }}>
                                          <CardHeader title="Test Cases" sx={{ mb: 3 }} />
                                          <Scrollbar>
                                            <TableContainer sx={{ maxHeight: 300 }}>
                                              <Table>
                                                <TableBody>
                                                  {accordion?.testCaseIDs &&
                                                    accordion?.testCaseIDs.slice(0).map((row) => (
                                                      <TableRow key={row.id}>
                                                        <TableCell style={{ padding: 10, paddingLeft: '1.5rem' }}>
                                                          {row}
                                                        </TableCell>
                                                      </TableRow>
                                                    ))}
                                                </TableBody>
                                              </Table>
                                            </TableContainer>
                                          </Scrollbar>
                                        </Card>
                                      </Grid>
                                    )}
                                    {accordion?.testPlaceholders && accordion?.testPlaceholders?.length > 0 && (
                                      <Grid item xs={12} md={6} style={{ marginTop: '1rem' }}>
                                        <Card style={{ boxShadow: '0 0 10px #919eab' }}>
                                          <CardHeader
                                            title="Execution Data"
                                            action={
                                              // isEdit && (
                                              <Stack direction="row" spacing={1}>
                                                {accordion?.testPlaceholders?.length === 1 && (
                                                  <Button
                                                    variant="outlined"
                                                    size="small"
                                                    onClick={(event) => {
                                                      handleExecutionDataEdit(event, accordion.moduleID);
                                                    }}
                                                    // onClick={handleExecutionDataEdit}
                                                  >
                                                    {moduleDataEdit[accordion.moduleID] ? 'Save' : 'Edit'}
                                                  </Button>
                                                )}

                                                <input
                                                  accept=".xls,.xlsx"
                                                  id="upload-file"
                                                  type="file"
                                                  style={{ display: 'none' }}
                                                  onChange={(event) => {
                                                    handleFileChange(event, accordion.moduleID);
                                                  }}
                                                />
                                                <label htmlFor="upload-file">
                                                  <Button variant="contained" size="small" component="span">
                                                    Upload File
                                                  </Button>
                                                </label>
                                              </Stack>
                                              // )
                                            }
                                            sx={{ mb: 3 }}
                                          />
                                          <Scrollbar>
                                            {accordion?.testPlaceholders?.length === 1 && (
                                              <TableContainer sx={{ maxHeight: 300 }}>
                                                <Table>
                                                  <TableHead>
                                                    <TableRow>
                                                      <TableCell>Key/Placeholder</TableCell>
                                                      <TableCell>Value</TableCell>
                                                    </TableRow>
                                                  </TableHead>
                                                  <TableBody>
                                                    {Object.keys(accordion?.testPlaceholders[0]) &&
                                                      Object.keys(accordion?.testPlaceholders[0])
                                                        .filter((key) => !EXCLUDE_SET_KEYS.includes(key))
                                                        .map((key) => (
                                                          <TableRow key={key}>
                                                            <TableCell style={{ padding: '5px 20px' }}>
                                                              <div
                                                                style={{
                                                                  display: 'flex',
                                                                  alignItems: 'center'
                                                                }}
                                                              >
                                                                <div
                                                                  style={{
                                                                    width: '50%',
                                                                    fontSize: '16px',
                                                                    fontWeight: '600',
                                                                    textTransform: 'capitalize',
                                                                    wordWrap: 'break-word'
                                                                  }}
                                                                >
                                                                  {key}
                                                                </div>
                                                                <div>
                                                                  {executionDataWithOV &&
                                                                    Array.isArray(executionDataWithOV) &&
                                                                    executionDataWithOV?.length > 0 && (
                                                                      <Autocomplete
                                                                        // value={executionDataWithOV[0][key][0]}
                                                                        value={(() => {
                                                                          try {
                                                                            const v =
                                                                              executionDataWithOV?.[0]?.[key]?.[0];
                                                                            if (v === undefined) {
                                                                              console.log(
                                                                                '%c🚨 Autocomplete value undefined',
                                                                                'color: red; font-weight: bold;',
                                                                                {
                                                                                  key,
                                                                                  value: executionDataWithOV?.[0]?.[key]
                                                                                }
                                                                              );
                                                                            }
                                                                            return v || '';
                                                                          } catch (err) {
                                                                            console.log(
                                                                              '%c❌ Error reading value',
                                                                              'color: red; font-weight: bold;',
                                                                              { key, err }
                                                                            );
                                                                            return '';
                                                                          }
                                                                        })()}
                                                                        onChange={(event, newValue) => {
                                                                          try {
                                                                            newValue = newValue
                                                                              .replace(/["]/g, '')
                                                                              .replace('Add ', '');
                                                                            handleExecutionDataWithOVChange(
                                                                              event,
                                                                              key,
                                                                              newValue,
                                                                              accordion?.moduleID
                                                                            );
                                                                          } catch (error) {
                                                                            //
                                                                          }
                                                                        }}
                                                                        filterOptions={(options, params) => {
                                                                          try {
                                                                            const filtered = filter(options, params);

                                                                            const { inputValue } = params;
                                                                            // Suggest the creation of a new value
                                                                            const isExisting = options.some(
                                                                              (option) => inputValue === option
                                                                            );
                                                                            if (inputValue !== '' && !isExisting) {
                                                                              filtered.push(`Add "${inputValue}"`);
                                                                            }

                                                                            return filtered;
                                                                          } catch (error) {
                                                                            //
                                                                          }
                                                                          return null;
                                                                        }}
                                                                        selectOnFocus
                                                                        clearOnBlur
                                                                        handleHomeEndKeys
                                                                        id="free-solo-with-text-demo"
                                                                        options={executionDataWithOV[0][key]}
                                                                        getOptionLabel={(option) => {
                                                                          try {
                                                                            // Value selected with enter, right from the input
                                                                            if (typeof option === 'string') {
                                                                              return option;
                                                                            }
                                                                            // Add "xxx" option created dynamically
                                                                            if (option.inputValue) {
                                                                              return option;
                                                                            }
                                                                            // Regular option
                                                                            return option;
                                                                          } catch (error) {
                                                                            console.log('error', error);
                                                                          }
                                                                          return null;
                                                                        }}
                                                                        renderOption={(props, option) => {
                                                                          // eslint-disable-next-line
                                                                          const { key, ...optionProps } = props;
                                                                          return (
                                                                            <li key={key} {...optionProps}>
                                                                              {option}
                                                                            </li>
                                                                          );
                                                                        }}
                                                                        sx={{ width: 300 }}
                                                                        freeSolo
                                                                        disabled={!moduleDataEdit[accordion.moduleID]}
                                                                        defaultValue={
                                                                          accordion?.testPlaceholders[0][key]
                                                                        }
                                                                        renderInput={(params) => (
                                                                          <TextField {...params} />
                                                                        )}
                                                                      />
                                                                    )}

                                                                  {/* <TextField
                                                                    required
                                                                    type={key === 'password' ? 'password' : 'text'}
                                                                    onChange={(event) => {
                                                                      if (executionDataEdit)
                                                                        handleTestPlaceholdersChange(
                                                                          event,
                                                                          accordion.moduleID,
                                                                          key
                                                                        );
                                                                    }}
                                                                    sx={{
                                                                      width: '100%',
                                                                      '& .MuiOutlinedInput-root': {
                                                                        '& > fieldset': {
                                                                          border: moduleDataEdit[accordion.moduleID]
                                                                            ? ''
                                                                            : 'none'
                                                                        }
                                                                      }
                                                                    }}
                                                                    disabled={!moduleDataEdit[accordion.moduleID]}
                                                                    id={key}
                                                                    defaultValue={accordion?.testPlaceholders[0][key]}
                                                                  /> */}
                                                                </div>
                                                              </div>
                                                            </TableCell>
                                                          </TableRow>
                                                        ))}
                                                  </TableBody>
                                                </Table>
                                              </TableContainer>
                                            )}
                                            {accordion?.testPlaceholders?.length > 1 && (
                                              <TableContainer sx={{ minWidth: 480, maxHeight: 300 }}>
                                                <Table stickyHeader>
                                                  <TableHead>
                                                    <TableRow>
                                                      {Object.keys(accordion?.testPlaceholders[0])
                                                        .filter((key) => !EXCLUDE_SET_KEYS.includes(key))
                                                        .map((key) => (
                                                          <TableCell key={key}>{key}</TableCell>
                                                        ))}
                                                    </TableRow>
                                                  </TableHead>
                                                  <TableBody>
                                                    {accordion?.testPlaceholders
                                                      .filter((key) => !EXCLUDE_SET_KEYS.includes(key))
                                                      .map(
                                                        (testData, index) =>
                                                          testData && (
                                                            <TableRow key={index}>
                                                              {Object.keys(testData)
                                                                .filter((key) => !EXCLUDE_SET_KEYS.includes(key))
                                                                .map((key) => (
                                                                  <TableCell key={`${key}${index}`}>
                                                                    {key === 'password' ? (
                                                                      <TextField
                                                                        required
                                                                        type={key === 'password' ? 'password' : 'text'}
                                                                        id={key}
                                                                        key={key}
                                                                        defaultValue={testData[key]}
                                                                        style={{ height: '2rem' }}
                                                                        inputProps={{ readOnly: true }}
                                                                        sx={{
                                                                          '& fieldset': { border: 'none' }
                                                                        }}
                                                                      />
                                                                    ) : (
                                                                      testData[key]
                                                                    )}
                                                                  </TableCell>
                                                                ))}
                                                              <TableCell>
                                                                <Icon
                                                                  icon={editFill}
                                                                  width={24}
                                                                  height={24}
                                                                  onClick={() => {
                                                                    setEdit(!edit);
                                                                    handleEdit(testData, index, accordion.moduleID);
                                                                  }}
                                                                  cursor="pointer"
                                                                />
                                                              </TableCell>
                                                            </TableRow>
                                                          )
                                                      )}
                                                  </TableBody>
                                                </Table>
                                              </TableContainer>
                                            )}
                                          </Scrollbar>
                                        </Card>
                                      </Grid>
                                    )}
                                  </Stack>
                                </Stack>
                              </AccordionDetails>
                            </Accordion>
                            <Icon
                              icon={trash2Outline}
                              width={24}
                              height={24}
                              style={{ marginTop: '10px', marginLeft: '10px', cursor: 'pointer' }}
                              onClick={() => handleRemoveModule(index)}
                            />
                          </div>
                        </>
                      ))}
                    </MotionInView>
                  </Scrollbar>
                </Grid>
              )}
            {!isLoading &&
              releaseData &&
              releaseData?.modules &&
              releaseData?.modules?.length !== 0 &&
              !multiModuleSelect && (
                <Grid item xs={12} md={12} style={{ marginTop: '1.5rem' }}>
                  <Stack
                    justifyContent="center"
                    alignItems="center"
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={{ xs: 3, sm: 2 }}
                  >
                    <Button variant="outlined" onClick={handleReleaseCancel}>
                      Cancel
                    </Button>
                    <Button variant="contained" type="submit" disabled={saveRelease}>
                      {isEdit ? (
                        <>
                          <ModeEditOutlineIcon />
                          Update
                        </>
                      ) : (
                        <>Create</>
                      )}
                    </Button>
                  </Stack>
                </Grid>
              )}
          </Grid>
          {isLoading && <LoadingScreen />}
          <Dialog open={open} onClose={handleClose}>
            <DialogTitle id="simple-dialog-title">Release Info</DialogTitle>
            <DialogContent>
              <DialogContentText id="alert-dialog-slide-description">
                <br />
                <br />
                Release Name with <b>[{values.name}]</b> already exists!!
                <br />
                <br />
                Please change Release Name
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button variant="contained" onClick={handleClose}>
                OK
              </Button>
            </DialogActions>
          </Dialog>
          <Dialog open={canDeleteRelease} onClose={handleClose}>
            <DialogTitle id="simple-dialog-title">Release Info</DialogTitle>
            <DialogContent>
              <DialogContentText id="alert-dialog-slide-description">
                <br />
                <br />
                You can't delete this module as it has below dependency modules !!
                <br />
                <br />
                {moduleNames.join(', ')}
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button variant="contained" onClick={handleClose}>
                OK
              </Button>
            </DialogActions>
          </Dialog>
        </Form>
      </FormikProvider>
      {testDataToEdit?.testData && (
        <Dialog open={edit} onClose={() => handleEditClose(false)}>
          <DialogTitle id="edit-testdata-row">Edit Test Data 1</DialogTitle>
          <DialogContent>
            <DialogContentText id="edit-testdata-row-description" />
            <form id="save-test-data" onSubmit={(e) => saveTestData(e)}>
              <TableContainer sx={{ minWidth: 480, maxHeight: 300 }}>
                <Table>
                  <TableBody>
                    {Object.keys(testDataToEdit?.testData)
                      ?.filter((key) => !EXCLUDE_SET_KEYS.includes(key))
                      .map((key, index) => (
                        <TableRow key={index}>
                          <TableCell style={{ padding: '5px 20px' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <div
                                style={{
                                  width: '50%',
                                  fontSize: '16px',
                                  fontWeight: '600',
                                  textTransform: 'capitalize'
                                }}
                              >
                                {key}
                              </div>
                              {/* <div>
                              <TextField
                                required
                                type={key === 'password' ? 'password' : 'text'}
                                sx={{
                                  width: '100%',
                                  '& .MuiOutlinedInput-root': {
                                    '& > fieldset': {
                                      border: 'none'
                                    }
                                  }
                                }}
                                id={key}
                                defaultValue={testDataToEdit?.testData[key]}
                                onChange={handleEditTestData}
                                name={key}
                              />
                            </div> */}
                            </div>
                          </TableCell>
                          {/* <div>
                              <TextField
                                required
                                type={key === 'password' ? 'password' : 'text'}
                                sx={{
                                  width: '100%',
                                  '& .MuiOutlinedInput-root': {
                                    '& > fieldset': {
                                      border: 'none'
                                    }
                                  }
                                }}
                                id={key}
                                defaultValue={testDataToEdit?.testData[key]}
                                onChange={handleEditTestData}
                                name={key}
                              />
                            </div> */}
                          <TableCell>
                            {EXCLUDE_KEYS.includes(key) && executionDataWithOV && executionDataWithOV?.length !== 0 && (
                              <TextField
                                required
                                type={key === 'password' ? 'password' : 'text'}
                                id={key}
                                defaultValue={executionDataWithOV[testDataToEdit?.index][key]}
                                value={executionDataWithOV[testDataToEdit?.index][key]}
                                style={{ height: '2rem', width: '50%' }}
                                SelectProps={{ native: true }}
                                onChange={(event) => {
                                  handleMultipleRowExecutionDataChange(event, key, testDataToEdit?.index);
                                }}
                              />
                            )}
                            {!EXCLUDE_KEYS.includes(key) && (
                              <Autocomplete
                                value={executionDataWithOV[testDataToEdit?.index][key][0]}
                                onChange={(event, newValue) => {
                                  try {
                                    newValue = newValue.replace(/["]/g, '').replace('Add ', '');
                                    handleExecutionMultipleDataWithOVChange(event, key, newValue, index);
                                  } catch (error) {
                                    console.log('error', error);
                                  }
                                }}
                                filterOptions={(options, params) => {
                                  try {
                                    const filtered = filter(options, params);

                                    const { inputValue } = params;
                                    // Suggest the creation of a new value
                                    const isExisting = options.some((option) => inputValue === option);
                                    if (inputValue !== '' && !isExisting) {
                                      filtered.push(`Add "${inputValue}"`);
                                    }

                                    return filtered;
                                  } catch (error) {
                                    //
                                  }
                                  return null;
                                }}
                                selectOnFocus
                                clearOnBlur
                                handleHomeEndKeys
                                id="free-solo-with-text-demo"
                                options={executionDataWithOV[testDataToEdit?.index][key]}
                                getOptionLabel={(option) => {
                                  try {
                                    // Value selected with enter, right from the input
                                    if (typeof option === 'string') {
                                      return option;
                                    }
                                    // Add "xxx" option created dynamically
                                    if (option.inputValue) {
                                      return option;
                                    }
                                    // Regular option
                                    return option;
                                  } catch (error) {
                                    console.log('error', error);
                                  }
                                  return null;
                                }}
                                renderOption={(props, option) => {
                                  // eslint-disable-next-line
                                  const { key, ...optionProps } = props;
                                  return (
                                    <li key={key} {...optionProps}>
                                      {option}
                                    </li>
                                  );
                                }}
                                sx={{ width: 300 }}
                                freeSolo
                                renderInput={(params) => <TextField {...params} />}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </form>
          </DialogContent>
          <DialogActions>
            <Button form="save-test-data" variant="contained" type="submit" onClick={() => handleEditClose(true)}>
              save
            </Button>
            <Button variant="contained" onClick={() => handleEditClose(false)}>
              cancel
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
