import * as Yup from 'yup';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { Form, FormikProvider, useFormik } from 'formik';
import { Icon } from '@iconify/react';
import plusFill from '@iconify/icons-eva/plus-fill';
// material
import { LoadingButton } from '@mui/lab';
import { styled } from '@mui/material/styles';
import { Card, Collapse, Grid, Stack, Button, TextField, Typography } from '@mui/material';
// utils
import fakeRequest from '../../../utils/fakeRequest';
//
import JsonNewCardForm from './JsonNewCardForm';

// ----------------------------------------------------------------------

const LabelStyle = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.palette?.text.secondary,
  marginBottom: theme.spacing(1)
}));

// ----------------------------------------------------------------------

export default function JsonBuilderForm() {
  const { enqueueSnackbar } = useSnackbar();
  const [setOpen] = useState(false);
  const [show, setShow] = useState(false);

  const handleOpenPreview = () => {
    setOpen(true);
  };

  const handleClosePreview = () => {
    setOpen(false);
  };

  const handleCollapseIn = () => {
    setShow((prev) => !prev);
  };

  const handleCollapseOut = () => {
    setShow(false);
  };

  const JsonBuilderSchema = Yup.object().shape({
    suiteName: Yup.string().required('Suite Name is required'),
    suiteDesc: Yup.string().max(200),
    testCaseID: Yup.string().required('Test CaseID is required'),
    testCaseTitle: Yup.string().required('Test Case Title is required'),
    testDesc: Yup.string().max(100, 'Test Description should be less than 100 characters')
  });

  const formik = useFormik({
    initialValues: {
      suiteName: '',
      suiteDesc: '',
      testCases: [],
      testDesc: '',
      dependsOn: '',
      priority: '',
      tags: [],
      testCaseSteps: []
    },
    validationSchema: JsonBuilderSchema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        console.log('entered');
        await fakeRequest(500);
        alert(JSON.stringify(values));
        resetForm();
        handleClosePreview();
        setSubmitting(false);
        enqueueSnackbar('Post success', { variant: 'success' });
      } catch (error) {
        console.error(error);
        console.log(error);
        setSubmitting(false);
      }
    }
  });

  const { errors, touched, handleSubmit, isSubmitting, getFieldProps } = formik;
  return (
    <>
      <FormikProvider value={formik}>
        <Form noValidate autoComplete="off" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card sx={{ p: 3 }}>
                <LabelStyle>Suite Details</LabelStyle>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Suite Name"
                    {...getFieldProps('suiteName')}
                    error={Boolean(touched.suiteName && errors.suiteName)}
                    helperText={touched.suiteName && errors.suiteName}
                  />

                  <TextField
                    fullWidth
                    multiline
                    size="small"
                    minRows={3}
                    maxRows={5}
                    label="Suite Description"
                    {...getFieldProps('suiteDesc')}
                    error={Boolean(touched.suiteDesc && errors.suiteDesc)}
                    helperText={touched.suiteDesc && errors.suiteDesc}
                  />

                  <div>
                    <LabelStyle>Test Cases</LabelStyle>
                    <Button
                      id="addNewCard"
                      type="button"
                      size="small"
                      startIcon={<Icon icon={plusFill} width={20} height={20} />}
                      onClick={handleCollapseIn}
                      sx={{ my: 1 }}
                    >
                      Add new TestCase
                    </Button>
                    <Collapse in={show}>
                      <JsonNewCardForm formik={formik} onCancel={handleCollapseOut} />
                    </Collapse>
                  </div>
                </Stack>
              </Card>
              <Stack direction="row" justifyContent="flex-start" sx={{ mt: 2 }}>
                <Button
                  fullWidth
                  type="button"
                  color="inherit"
                  variant="outlined"
                  size="small"
                  onClick={handleOpenPreview}
                  sx={{ mr: 1.5 }}
                >
                  Preview
                </Button>
                <LoadingButton fullWidth type="submit" variant="contained" size="large" loading={isSubmitting}>
                  Create
                </LoadingButton>
              </Stack>
            </Grid>
          </Grid>
        </Form>
      </FormikProvider>
    </>
  );
}
