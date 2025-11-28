// utils
// import axios from 'axios';

// import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import axios from '../../utils/axiosInstance';
import { getSessionObj, setSessionObj } from '../../utils/jwt';
import { HTTP_REQUEST, PERSIST_STORE } from '../../Constants';
import {
  setDefaultRoleConfig,
  setClientsRoleConfig,
  setRoleConfig,
  setRolesList,
  setPageConfig,
  setTestCasesConfig,
  setFetchRoledata
} from './role';
import { setProjectList } from './project';
import { setModuleList, setFetchModuleData, setCurrentModule } from './module';
import { setReleaseList, setExecutionDuration, setModuleData } from './release';
import { setTestRunsList, setAllTestRunsList } from './testRun';
import { setUserList, setUserIsSSO, setUserRequestPassword, setUserAppendUrl, setCurrentUser } from './user';
import { setCompanyList } from './company';
import { getReleaseStatus } from '../../_apis_/release';
import { getTestRunStatus } from '../../_apis_/testRun';
import { setIDBCurrentUser } from '../../main';

// ----------------------------------------------------------------------

export const callBackendService = async (method, url, data) => {
  let response = null;
  if ([HTTP_REQUEST.GET, HTTP_REQUEST.DELETE].includes(method)) {
    response = await axios({
      method,
      url,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
  } else {
    response = await axios({
      method,
      url,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
  }

  return response?.data;
};

export const clearSSOData = (dispatch) => {
  setUserIsSSO(dispatch, true);
  setFetchRoledata(dispatch, false);
  setRoleConfig(dispatch, null);
  setRolesList(dispatch, null);
  setPageConfig(dispatch, null);
  setTestCasesConfig(dispatch, null);
  setDefaultRoleConfig(dispatch, null);
  setClientsRoleConfig(dispatch, null);
  setProjectList(dispatch, null);
  setModuleList(dispatch, null);
  setReleaseList(dispatch, null);
  setTestRunsList(dispatch, null);
  setAllTestRunsList(dispatch, null);
  setUserList(dispatch, []);
  setCompanyList(dispatch, null);
  setUserAppendUrl(dispatch, null);
  setCurrentUser(dispatch, null);
  setSessionObj(PERSIST_STORE.USER);
  setIDBCurrentUser(null);
};

export const clearSSO = (dispatch) => {
  setUserAppendUrl(dispatch, null);
};

export const clearData = (dispatch) => {
  setIDBCurrentUser(null);
  setSessionObj(PERSIST_STORE.USER);
  setCurrentUser(dispatch, null);
  setUserIsSSO(dispatch, false);
  setFetchRoledata(dispatch, true);
  setRoleConfig(dispatch, null);
  setRolesList(dispatch, null);
  setPageConfig(dispatch, null);
  setTestCasesConfig(dispatch, null);
  setDefaultRoleConfig(dispatch, null);
  setClientsRoleConfig(dispatch, null);
  setProjectList(dispatch, null);
  setModuleList(dispatch, null);
  setReleaseList(dispatch, null);
  setTestRunsList(dispatch, null);
  setAllTestRunsList(dispatch, null);
  setUserList(dispatch, []);
  setCompanyList(dispatch, null);
  setUserIsSSO(dispatch, true);
  setUserRequestPassword(dispatch, false);
  setUserAppendUrl(dispatch, null);
};

export const allModulesClearData = (dispatch) => {
  setFetchModuleData(dispatch, true);
  setRolesList(dispatch, null);
  setFetchRoledata(dispatch, true);
  setReleaseList(dispatch, null);
  setTestRunsList(dispatch, null);
  setAllTestRunsList(dispatch, null);
  setTestCasesConfig(dispatch, null);
};

export const allReleasesClearData = (dispatch) => {
  setFetchModuleData(dispatch, true);
  setRolesList(dispatch, null);
  setModuleList(dispatch, null);
  setTestRunsList(dispatch, null);
  setAllTestRunsList(dispatch, null);
  setCurrentModule(dispatch, null);
};

export const testRunsClearData = (dispatch) => {
  setFetchModuleData(dispatch, true);
  setRolesList(dispatch, null);
  setModuleList(dispatch, null);
  setReleaseList(dispatch, null);
  setCurrentModule(dispatch, null);
};

export const refreshTestCases = async (dispatch, releaseId, testRunId) => {
  setExecutionDuration(dispatch, null);
  let moduleData;
  if (releaseId) moduleData = await getReleaseStatus(releaseId);
  else if (testRunId) moduleData = await getTestRunStatus(testRunId);
  setModuleData(dispatch, moduleData?.modules);
};

// export const downloadExcel = (data, fileName) => {
//   try {
//     const workbook = XLSX.utils.book_new();
//     data?.forEach((excelData) => {
//       const worksheet = XLSX.utils.json_to_sheet(excelData?.edata);
//       XLSX.utils.book_append_sheet(workbook, worksheet, excelData?.sname);
//     });
//     XLSX.writeFile(workbook, fileName);
//   } catch (error) {
//     console.log('error', error);
//   }
// };

// const jsonData = [
//   { name: 'John Doe', age: 28, city: 'New York' },
//   { name: 'Jane Smith', age: 32, city: 'Los Angeles' },
//   { name: 'Michael Johnson', age: 45, city: 'Chicago' }
// ];

const sanitize = (s) =>
  String(s)
    .replace(/[\\*?:\/\[\]\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

export const exportToExcel = async (data, testCaseID, fileName, manual) => {
  try {
    console.log(data);
    const workbook = new ExcelJS.Workbook();
    data?.forEach((sData) => {
      if (manual) {
        const mworksheet = workbook.addWorksheet('Index');
        const data = [
          { suiteName: 'Gen AI Test Cases', suiteDescription: 'Gen AI Test Cases', sheetName: sData.sname }
        ];
        mworksheet.columns = [
          { header: 'Suite Name', key: 'suiteName', width: 30 },
          { header: 'Suite Description', key: 'suiteDescription', width: 30 },
          { header: 'Associated Sheet Name', key: 'sheetName', width: 30 }
        ];

        mworksheet.addRows(data);

        // Apply styles
        mworksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          row.eachCell({ includeEmpty: false }, (cell) => {
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
              top: { style: 'hair' },
              left: { style: 'hair' },
              bottom: { style: 'hair' },
              right: { style: 'hair' }
            };
            if (rowNumber === 1) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '46d246' }
              };
              cell.font = {
                name: 'Calibri',
                bold: true,
                color: { argb: '000000' }
              };
            }
          });
        });
      }

      try {
        const worksheet = workbook.addWorksheet(sanitize(sData.sname));

        // Add header row
        if (manual) {
          worksheet.columns = [
            { header: 'ID', key: 'testCaseID', width: 15 },
            { header: 'Depends On', key: 'dependsOn', width: 15 },
            { header: 'Test Title', key: 'testCaseTitle', width: 30 },
            { header: 'Test Case Description', key: 'testCaseDescription', width: 30 },
            { header: 'Step No', key: 'StepNo', width: 10 },
            { header: 'Step Description', key: 'testStepDescription', width: 40 },
            { header: 'Expected', key: 'Expected', width: 40 }
          ];
        } else if (testCaseID) {
          worksheet.columns = [
            { header: 'Test Case ID', key: 'testCaseID', width: 15 },
            { header: 'Test Case Title', key: 'testCaseTitle', width: 30 },
            { header: 'Test Case Description', key: 'testCaseDescription', width: 30 },
            { header: 'Step No', key: 'StepNo', width: 10 },
            { header: 'Test Step Description', key: 'testStepDescription', width: 40 },
            { header: 'Expected', key: 'Expected', width: 40 }
          ];
        } else {
          worksheet.columns = [
            { header: 'Test Case Title', key: 'testCaseTitle', width: 30 },
            { header: 'Test Case Description', key: 'testCaseDescription', width: 30 },
            { header: 'Step No', key: 'StepNo', width: 10 },
            { header: 'Test Step Description', key: 'testStepDescription', width: 40 },
            { header: 'Expected', key: 'Expected', width: 40 }
          ];
        }

        // Add rows
        worksheet.addRows(sData.edata);

        // Apply styles
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          row.eachCell({ includeEmpty: false }, (cell) => {
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
              top: { style: 'hair' },
              left: { style: 'hair' },
              bottom: { style: 'hair' },
              right: { style: 'hair' }
            };
            if (rowNumber === 1) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '46d246' }
              };
              cell.font = {
                name: 'Calibri',
                bold: true,
                color: { argb: '000000' }
              };
            }
          });
        });
      } catch (error) {
        console.log(`Error while attaching the sheet ${sData.sname} to workook : ${error}`);
      }
    });

    // Create a buffer and save the file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    saveAs(blob, fileName);
  } catch (error) {
    console.log('error', error);
  }
};

export const exportToMergeExcel = async (data, testCaseID, mergeCells, fileName) => {
  try {
    console.log(data);
    const workbook = new ExcelJS.Workbook();
    data?.forEach((sData) => {
      const worksheet = workbook.addWorksheet(sData.sname);

      // Add header row
      if (testCaseID) {
        worksheet.columns = [
          { header: 'Test Case ID', key: 'testCaseID', width: 15 },
          { header: 'Test Case Title', key: 'testCaseTitle', width: 30 },
          { header: 'Test Case Description', key: 'testCaseDescription', width: 30 },
          { header: 'Step No', key: 'StepNo', width: 10 },
          { header: 'Test Step Description', key: 'testStepDescription', width: 40 },
          { header: 'Expected', key: 'Expected', width: 40 }
        ];
      } else {
        worksheet.columns = [
          { header: 'Test Case Title', key: 'testCaseTitle', width: 30 },
          { header: 'Test Case Description', key: 'testCaseDescription', width: 30 },
          { header: 'Step No', key: 'StepNo', width: 10 },
          { header: 'Test Step Description', key: 'testStepDescription', width: 40 },
          { header: 'Expected', key: 'Expected', width: 40 }
        ];
      }

      // Add rows
      worksheet.addRows(sData.edata);

      // Apply styles
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.border = {
            top: { style: 'hair' },
            left: { style: 'hair' },
            bottom: { style: 'hair' },
            right: { style: 'hair' }
          };
          if (rowNumber === 1) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: '46d246' }
            };
            cell.font = {
              name: 'Calibri',
              bold: true,
              color: { argb: '000000' }
            };
          }
        });
      });

      let startCell = 2;
      let endCell = parseInt(mergeCells[0] + 1, 10);

      mergeCells?.forEach((mergeCell, index) => {
        try {
          if (index !== 0) startCell = parseInt(endCell + 1, 10);
          endCell = parseInt(startCell + mergeCell - 1, 10);
          worksheet.mergeCells(`E${startCell}`, `E${endCell}`);
        } catch (err) {
          console.log('err', err);
        }
      });
    });

    // Create a buffer and save the file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    saveAs(blob, fileName);
  } catch (error) {
    console.log('error', error);
  }
};

// export const exportTestCasesWithSteps = async (
//   data,
//   options,
//   defectList,
//   screenshot,
//   pageName,
//   fileName = 'TestResults.xlsx'
// ) => {
//   let details;
//   let summary;
//   const workbook = new ExcelJS.Workbook();
//   const worksheet = workbook.addWorksheet('Test Results');
//   worksheet.columns = [
//     { header: 'Test Case ID', key: 'testCaseID', width: 15 },
//     { header: 'Title', key: 'testCaseTitle', width: 30 },
//     { header: 'Description', key: 'testCaseDescription', width: 50 },
//     // { header: 'Suite Name', key: 'suiteName', width: 20 },
//     // { header: 'Module ID', key: 'moduleId', width: 20 },
//     // { header: 'Status', key: 'status', width: 10 },
//     // Excluding the below column for Modules page
//     ...(pageName !== 'Modules' ? [{ header: 'Status', key: 'status', width: 10 }] : []),
//     { header: 'Execution Duration', key: 'executionDuration', width: 15 },
//     // { header: 'Execution Start', key: 'executionStart', width: 20 },
//     // { header: 'Execution End', key: 'executionEnd', width: 20 },
//     // { header: 'Tags', key: 'tags', width: 25 },
//     // { header: 'Automation Status', key: 'automationStatus', width: 15 },
//     { header: 'Step No', key: 'stepNumber', width: 10 },
//     { header: 'Test Step Description', key: 'testCaseSteps', width: 50 },
//     // Excluding the below column for Modules page
//     ...(pageName !== 'Modules' ? [{ header: 'Test Step Status', key: 'testStepStatuses', width: 15 }] : []),
//     // { header: 'Test Step Status', key: 'testStepStatuses', width: 15 }
//     ...(pageName !== 'Modules' && defectList && defectList.length > 0
//       ? [{ header: 'Issue Link', key: 'issueLink', width: 50 }]
//       : []),
//     ...(pageName !== 'Modules' && screenshot ? [{ header: 'Screenshot', key: 'screenshot', width: 50 }] : [])
//   ];
//   let rowIndex = 2; // Row 1 is for headers
//   if (pageName !== 'Modules') {
//     ({ details, summary } = data);
//   } else {
//     ({ details } = data);
//   }
//   details.forEach((testCase) => {
//     const { stepNumbers, testCaseSteps, testStepStatuses, issueLink } = testCase;
//     const startRow = rowIndex;
//     // If there are no steps, ensure the test case is still added
//     const totalSteps = stepNumbers.length || 1;
//     for (let i = 0; i < totalSteps; i += 1) {
//       const isFailedStep = testStepStatuses[i] === 'FAILED';
//       worksheet.addRow({
//         testCaseID: i === 0 ? testCase.testCaseID : '',
//         testCaseTitle: i === 0 ? testCase.testCaseTitle : '',
//         testCaseDescription: i === 0 ? testCase.testCaseDescription : '',
//         // suiteName: i === 0 ? testCase.suiteName : '',
//         // moduleId: i === 0 ? testCase.moduleId : '',
//         status: i === 0 ? testCase.status : '',
//         executionDuration: i === 0 ? testCase.executionDuration : '',
//         // executionStart: i === 0 ? testCase.executionStart : '',
//         // executionEnd: i === 0 ? testCase.executionEnd : '',
//         // tags: i === 0 ? testCase.tags.join(', ') : '',
//         // automationStatus: i === 0 ? (testCase.automationStatus && 'Yes') || 'No' : '',
//         stepNumber: stepNumbers[i] || '',
//         testCaseSteps: testCaseSteps[i] || '',
//         testStepStatuses: testStepStatuses[i] || '',
//         issueLink: issueLink[i] || '',
//         screenshot: ''
//       });

//       // if (isFailedStep && screenshot) {
//       //   const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '');
//       //   const imageId = workbook.addImage({
//       //     base64: base64Data,
//       //     extension: 'png'
//       //   });

//       //   // Place image in the last column (Screenshot column)
//       //   worksheet.addImage(imageId, {
//       //     tl: { col: worksheet.columns.length - 1, row: rowIndex - 1 },
//       //     ext: { width: 100, height: 80 }
//       //   });
//       // }

//       if (isFailedStep && screenshot) {
//         const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '');
//         const imageId = workbook.addImage({
//           base64: base64Data,
//           extension: 'png'
//         });

//         const imgWidth = 100;
//         const imgHeight = 80;

//         // Insert image into last column cell
//         worksheet.addImage(imageId, {
//           tl: { col: worksheet.columns.length - 1, row: rowIndex - 1 },
//           ext: { width: imgWidth, height: imgHeight }
//         });

//         // Dynamically adjust row height to fit image
//         const row = worksheet.getRow(rowIndex);
//         row.height = imgHeight * 0.75; // Excel row height ≈ pixels * 0.75
//       }

//       rowIndex += 1; // Move to the next row
//     }
//     // Merge cells for the Test Case ID & other repeating fields (only if there are multiple steps)
//     if (totalSteps.length > 1) {
//       [
//         'A', // Test Case ID
//         'B', // Test Case Title
//         'C', // Test Case Description
//         // 'D', // Suite Name
//         // 'E', // Module ID
//         'D', // Status
//         'E' // Execution Duration
//         // 'H', // Execution Start
//         // 'I', // Execution End
//         // 'G', // Tags
//         // 'H' // Automation Status
//       ].forEach((col) => {
//         worksheet.mergeCells(`${col}${startRow}:${col}${rowIndex - 1}`);
//       });
//     }
//   });
//   // Hide columns based on missing data
//   worksheet.columns.forEach((column) => {
//     if (
//       // Exclude "stepNumber" from hiding logic as number's columns being hidden
//       column.key !== 'stepNumber' &&
//       column.key !== 'screenshot' &&
//       details.every((row) => !row[column.key] || row[column.key].length === 0)
//     ) {
//       column.hidden = true; // Hide if all rows have empty or missing values
//     }
//   });

//   // Summary sheet in excel shall be present only when downloading excel
//   // either from Releases and Test Run screen; Not from Module screen
//   if (pageName !== 'Modules') {
//     if (summary) {
//       const summarySheet = workbook.addWorksheet('Summary');
//       const summaryRows = [['Release Name', summary.releaseName]];

//       // Add Test Run Name only if it exists (not null/undefined/empty)
//       if (summary.testRunName) {
//         summaryRows.push(['Test Run Name', summary.testRunName]);
//       }

//       // Continue with the rest of the rows
//       summaryRows.push(
//         ['Execution Start Time', summary.executionStart],
//         ['Execution End Time', summary.executionEnd],
//         ['Execution Duration', summary.executionDuration],
//         ['Executed By (tst run)', summary.user],
//         ['Total Cases', summary.total],
//         ['Passed', summary.passed],
//         ['Failed', summary.failed],
//         ['Skipped', summary.skipped],
//         ['Untested', summary.untested],
//         ['Blocked', summary.blocked]
//       );
//       summarySheet.columns = [
//         { width: 35 }, // for the "Field" column
//         { width: 35 } // for the "Value" column
//       ];
//       summaryRows.forEach((row) => {
//         summarySheet.addRow(row);
//       });
//     }
//   }

//   const buffer = await workbook.xlsx.writeBuffer();
//   const blob = new Blob([buffer], { type: 'application/octet-stream' });
//   saveAs(blob, fileName);
// };

// ----------------------------------------------------

export const exportTestCasesWithSteps = async (
  data,
  options,
  defectList,
  screenshot,
  log,
  pageName,
  fileName = 'TestResults.xlsx'
) => {
  let details;
  let summary;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Test Results');

  // Define columns dynamically
  worksheet.columns = [
    { header: 'Test Case ID', key: 'testCaseID', width: 15 },
    { header: 'Title', key: 'testCaseTitle', width: 30 },
    { header: 'Description', key: 'testCaseDescription', width: 50 },
    ...(pageName !== 'Modules' ? [{ header: 'Status', key: 'status', width: 10 }] : []),
    { header: 'Execution Duration', key: 'executionDuration', width: 15 },
    { header: 'Step No', key: 'stepNumber', width: 10 },
    { header: 'Test Step Description', key: 'testCaseSteps', width: 50 },
    ...(pageName !== 'Modules' && log ? [{ header: 'Actual Test Case Step Description', key: 'log', width: 50 }] : []),
    ...(pageName !== 'Modules' ? [{ header: 'Test Step Status', key: 'testStepStatuses', width: 15 }] : []),
    ...(pageName !== 'Modules' && defectList && defectList.length > 0
      ? [{ header: 'Issue Link', key: 'issueLink', width: 50 }]
      : []),
    ...(pageName !== 'Modules' && screenshot ? [{ header: 'Screenshot', key: 'screenshot', width: 50 }] : [])
  ];

  let rowIndex = 2; // Row 1 is headers

  if (pageName !== 'Modules') {
    ({ details, summary } = data);
  } else {
    ({ details } = data);
  }

  // Use for...of because we need async/await for images
  for (const testCase of details) {
    const { stepNumbers, testCaseSteps, testStepStatuses, issueLink } = testCase;
    // const { stepNumbers, testCaseSteps, testStepStatuses, actualTestCaseStep, expectedTestCaseStep, issueLink } =
    //   testCase;
    const startRow = rowIndex;
    const totalSteps = stepNumbers.length || 1;

    for (let i = 0; i < totalSteps; i++) {
      const isFailedStep = testStepStatuses[i] === 'FAILED';

      worksheet.addRow({
        testCaseID: i === 0 ? testCase.testCaseID : '',
        testCaseTitle: i === 0 ? testCase.testCaseTitle : '',
        testCaseDescription: i === 0 ? testCase.testCaseDescription : '',
        status: i === 0 ? testCase.status : '',
        executionDuration: i === 0 ? testCase.executionDuration : '',
        stepNumber: stepNumbers[i] || '',
        testCaseSteps: testCaseSteps[i] || '',
        // actualTestCaseStep: actualTestCaseStep[i] || '',
        // expectedTestCaseStep: expectedTestCaseStep[i] || '',
        testStepStatuses: testStepStatuses[i] || '',
        issueLink: issueLink[i] || '',
        log: isFailedStep && log ? log : '',
        screenshot: ''
      });

      // If failed step + screenshot available → add image
      if (isFailedStep && screenshot) {
        const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '');
        const { width, height } = await getImageDimensions(screenshot);

        const imageId = workbook.addImage({
          base64: base64Data,
          extension: 'png'
        });

        const colIndex = worksheet.columns.length - 1; // Screenshot column index
        worksheet.addImage(imageId, {
          tl: { col: colIndex, row: rowIndex - 1 },
          ext: { width, height }
        });

        // Adjust row height (1 point ≈ 0.75px)
        worksheet.getRow(rowIndex).height = height * 0.75;

        // Adjust screenshot column width (1 col unit ≈ 7px)
        worksheet.getColumn(colIndex + 1).width = Math.ceil(width / 7);
      }

      rowIndex += 1;
    }

    // Merge repeated cells if multiple steps
    if (totalSteps > 1) {
      ['A', 'B', 'C', 'D', 'E'].forEach((col) => {
        worksheet.mergeCells(`${col}${startRow}:${col}${rowIndex - 1}`);
      });
    }
  }

  // Hide empty columns
  worksheet.columns.forEach((column) => {
    if (
      column.key !== 'stepNumber' &&
      column.key !== 'screenshot' &&
      column.key !== 'log' &&
      details.every((row) => !row[column.key] || row[column.key].length === 0)
    ) {
      column.hidden = true;
    }
  });

  // Add summary sheet only if not "Modules"
  if (pageName !== 'Modules' && summary) {
    const summarySheet = workbook.addWorksheet('Summary');
    const summaryRows = [['Release Name', summary.releaseName]];

    if (summary.testRunName) {
      summaryRows.push(['Test Run Name', summary.testRunName]);
    }

    summaryRows.push(
      ['Execution Start Time', summary.executionStart],
      ['Execution End Time', summary.executionEnd],
      ['Execution Duration', summary.executionDuration],
      ['Executed By (tst run)', summary.user],
      ['Total Cases', summary.total],
      ['Passed', summary.passed],
      ['Failed', summary.failed],
      ['Skipped', summary.skipped],
      ['Untested', summary.untested],
      ['Blocked', summary.blocked]
    );

    summarySheet.columns = [{ width: 35 }, { width: 35 }];
    summaryRows.forEach((row) => {
      summarySheet.addRow(row);
    });
  }

  // Generate and download Excel
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  saveAs(blob, fileName);
};

export const exportRelasesWithTestCases = async (data, action, selectedOptions, fileName = 'TestResults.xlsx') => {
  const workbook = new ExcelJS.Workbook();
  const { testCases, testCaseSteps, testCaseStepStatus } = selectedOptions;
  data.forEach((release, index) => {
    const worksheet = workbook.addWorksheet(`Release-${index + 1}`);

    // Add summary section at the top if present
    let rowIndex = 1;

    if (release) {
      worksheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
      worksheet.getCell(`A${rowIndex}`).value = 'Release Summary';
      worksheet.getCell(`A${rowIndex}`).font = { bold: true, size: 14 };
      rowIndex += 1;

      worksheet.addRow([]);
      rowIndex += 1;

      worksheet.addRow(['Release Name', release.releaseName]);
      rowIndex += 1;

      if (release.testRunName) {
        worksheet.addRow(['Test Run Name', release.testRunName]);
        rowIndex += 1;
      }

      worksheet.addRow(['Execution Start Time', release.executionStart]);
      rowIndex += 1;
      worksheet.addRow(['Execution End Time', release.executionEnd]);
      rowIndex += 1;
      worksheet.addRow(['Execution Duration', release.executionDuration]);
      rowIndex += 1;
      worksheet.addRow(['Executed By (tst run)', release.user]);
      rowIndex += 1;
      worksheet.addRow(['Total Cases', release.total]);
      rowIndex += 1;
      worksheet.addRow(['Passed', release.passed]);
      rowIndex += 1;
      worksheet.addRow(['Failed', release.failed]);
      rowIndex += 1;
      worksheet.addRow(['Skipped', release.skipped]);
      rowIndex += 1;
      worksheet.addRow(['Untested', release.untested]);
      rowIndex += 1;
      worksheet.addRow(['Blocked', release.blocked]);
      rowIndex += 1;

      rowIndex += 2; // Add empty space before test case details
      worksheet.columns = [{ width: 20 }, { width: 30 }];
    }

    if (release.testCases && testCases) {
      worksheet.mergeCells(`A${rowIndex}:H${rowIndex}`);
      worksheet.getCell(`A${rowIndex}`).value = 'Test Cases Summary';
      worksheet.getCell(`A${rowIndex}`).font = { bold: true, size: 14 };
      rowIndex += 1;

      worksheet.addRow([]);
      rowIndex += 1;

      worksheet.columns = [
        { key: 'testCaseId', width: 20 },
        { key: 'testCaseTitle', width: 30 },
        { key: 'testCaseDescription', width: 50 },
        { key: 'testCaseStatus', width: 10 },
        { key: 'testCaseExecutionDuration', width: 15 },
        { key: 'testCaseStepNumbers', width: 10 },
        { key: 'testCaseSteps', width: 50 },
        { key: 'testCaseStepStatus', width: 15 }
      ];

      // Add Test Case details headers
      worksheet.getRow(rowIndex).values = [
        'Test Case ID',
        'Title',
        'Description',
        'Status',
        'Execution Duration',
        'Step No',
        'Test Step Description',
        'Test Step Status'
      ];
      worksheet.getRow(rowIndex).font = { bold: true };
      rowIndex += 1;

      const testCasesLength = release.testCases.length;
      // Add test case details
      release.testCases.forEach((testCase) => {
        if (testCaseSteps) {
          const { testCaseStepNumbers, testCaseSteps, testCaseStepStatus } = testCase;
          const totalSteps = testCaseStepNumbers.length || 1;
          const startRow = rowIndex;
          for (let i = 0; i < totalSteps; i += 1) {
            worksheet.addRow({
              testCaseId: i === 0 ? testCase.testCaseId : '',
              testCaseTitle: i === 0 ? testCase.testCaseTitle : '',
              testCaseDescription: i === 0 ? testCase.testCaseDescription : '',
              testCaseStatus: i === 0 ? testCase.testCaseStatus : '',
              testCaseExecutionDuration: i === 0 ? testCase.testCaseExecutionDuration : '',
              testCaseStepNumbers: testCaseStepNumbers[i] || '',
              testCaseSteps: testCaseSteps[i] || '',
              testCaseStepStatus: testCaseStepStatus[i] || ''
            });
            rowIndex += 1;
          }
          if (totalSteps.length > 1) {
            ['A', 'B', 'C', 'D', 'E'].forEach((col) => {
              worksheet.mergeCells(`${col}${startRow}:${col}${rowIndex - 1}`);
            });
          }
        } else {
          worksheet.addRow({
            testCaseId: testCase.testCaseId || '',
            testCaseTitle: testCase.testCaseTitle || '',
            testCaseDescription: testCase.testCaseDescription || '',
            testCaseStatus: testCase.testCaseStatus || '',
            testCaseExecutionDuration: testCase.testCaseExecutionDuration || ''
          });
          rowIndex += 1;
        }
      });

      if (!testCaseSteps) {
        worksheet.getColumn('testCaseStepNumbers').hidden = true;
        worksheet.getColumn('testCaseSteps').hidden = true;
        worksheet.getColumn('testCaseStepStatus').hidden = true;
      }

      if (!testCaseStepStatus) {
        worksheet.getColumn('testCaseStepStatus').hidden = true;
      }
    }
  });

  // Final file saving
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  if (action === 'mail') return blob;
  if (action === 'download') saveAs(blob, fileName);
};

function getImageDimensions(base64String) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = base64String; // data:image/png;base64,...
  });
}

export default { clearData, callBackendService };
