import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import PropTypes from 'prop-types';
import React, { useState, useEffect, useCallback } from 'react';
import * as Yup from 'yup';
import 'react-toastify/dist/ReactToastify.css';
import { useFormik } from 'formik';
import { styled } from '@mui/material/styles';
import { EditorState, ContentState } from 'draft-js';
import { useSelector } from '../../../redux/store';
import { DraftEditor } from '../../editor';

const LabelStyle = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.palette?.text.secondary,
  marginBottom: theme.spacing(1)
}));

SampleNextArrow.propTypes = {
  style: PropTypes.object,
  onClick: PropTypes.object,
  className: PropTypes.object
};

function SampleNextArrow(props) {
  const { className, style, onClick } = props;
  return (
    /* eslint-disable */
    <div className={className} style={{ ...style, display: 'block', background: 'grey' }} onClick={onClick} />
    /* eslint-enable */
  );
}

SamplePrevArrow.propTypes = {
  style: PropTypes.object,
  onClick: PropTypes.object,
  className: PropTypes.object
};

function SamplePrevArrow(props) {
  const { className, style, onClick } = props;
  /* eslint-disable */
  return <div className={className} style={{ ...style, display: 'block', background: 'grey' }} onClick={onClick} />;
  /* eslint-enable */
}

export const findVal = (object, key) => {
  let value;
  Object.keys(object).some((k) => {
    if (k === key) {
      value = object[k];
      return true;
    }
    if (object[k] && typeof object[k] === 'object') {
      value = findVal(object[k], key);
      return value !== undefined;
    }
    return value;
  });
  return value;
};

DefectCreation.propTypes = {
  open: PropTypes.bool,
  setOpen: PropTypes.func,
  testCase: PropTypes.object,
  testStepDesc: PropTypes.object
};

export default function DefectCreation({ open, setOpen, testCase, testStepDesc }) {
  const [edited, setEdited] = useState(false);
  const testStepDetails = useSelector((state) => state.testRun.testStepDetails);
  const testCaseDetails = useSelector((state) => state.testRun.testCaseDetails);
  const [draftSimple, setDraftSimple] = useState(() => {
    const content = ContentState.createFromText(testStepDesc);
    return EditorState.createWithContent(content);
  });

  const TestResultsSchema = Yup.object().shape({
    // images: Yup.array().max(2, 'maximum of 15 screenshots per test case')
  });

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      images: [],
      testCaseScreenshots: [],
      issueTitle: testCase?.testCaseDescription
    },
    validationSchema: TestResultsSchema,
    onSubmit: async (values, { setSubmitting, resetForm, setErrors }) => {
      try {
        resetForm();
        setSubmitting(false);
      } catch (error) {
        console.error(error);
        setSubmitting(false);
        setErrors(error);
      }
    }
  });

  // const { values, errors, touched, handleSubmit, isSubmitting, setFieldValue, getFieldProps } = formik;

  const { errors, touched, getFieldProps } = formik;

  const handleClose = () => {
    setOpen(false);
  };

  const setInitialValues = useCallback(() => {
    if (testCaseDetails?.selectedTestCaseStatus) {
      if (
        testCaseDetails?.selectedTestCaseStatus === 'PASSED' ||
        testCaseDetails?.selectedTestCaseStatus === 'FAILED'
      ) {
        let $testStepDetails;
        if (testStepDetails && testStepDetails?.length > 0) {
          $testStepDetails = [...testStepDetails];
          testStepDetails.forEach((step, index) => {
            $testStepDetails[index] = { ...$testStepDetails[index], status: testCaseDetails?.selectedTestCaseStatus };
          });
        }
      }
    }
  }, [testCaseDetails, testStepDetails]);

  const saveTestCase = async () => {};

  useEffect(() => {
    setInitialValues();
  }, [testCaseDetails, setInitialValues]);

  // useEffect(() => {
  //   getTestStepDesc(testStepId);
  // }, [getTestStepDesc, testStepId]);

  return (
    <>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Create Issue in Jira</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <Stack direction="row" spacing={6} paddingTop={2} paddingBottom={2}>
              {/* <Stack> */}
              <TextField
                fullWidth
                label="Issue Title"
                size="small"
                // value={testCase?.testCaseDescription}
                placeholder="Issue Title"
                SelectProps={{ native: true }}
                {...getFieldProps('issueTitle')}
                error={Boolean(touched.issueTitle && errors.issueTitle)}
                helperText={touched.issueTitle && errors.issueTitle}
              />
              {/* </Stack> */}
            </Stack>
          </DialogContentText>
          <Stack direction="column" spacing={6} alignContent="center" justifyContent="center">
            <Stack>
              <LabelStyle>Issue Summary</LabelStyle>
              <DraftEditor
                editorState={draftSimple}
                simple
                placeholder="Write something awesome..."
                onEditorStateChange={(value) => {
                  setEdited(true);
                  setDraftSimple(value);
                  console.log('value', value);
                }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="inherit">
            Cancel
          </Button>
          <Button onClick={saveTestCase} variant="contained" type="submit" disabled={!edited}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
