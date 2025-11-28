import PropTypes from 'prop-types';
import { Icon } from '@iconify/react';
import { useState } from 'react';
import plusFill from '@iconify/icons-eva/plus-fill';
import { styled } from '@mui/material/styles';
// material
import { Chip, Collapse, Paper, Stack, Button, TextField, Typography, Autocomplete } from '@mui/material';
//
import JsonNewStepForm from './JsonNewStepForm';

// ----------------------------------------------------------------------

JsonNewCardForm.propTypes = {
  formik: PropTypes.object,
  onCancel: PropTypes.func
};

const TAGS_OPTION = ['Smoke Test', 'Negative Test'];

const PRIORITY_OPTION = ['P1', 'P2', 'P3'];

const LabelStyle = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.palette?.text.secondary,
  marginBottom: theme.spacing(1)
}));

export default function JsonNewCardForm({ formik, onCancel }) {
  const [show, setShow] = useState(false);
  const { errors, touched, values, resetForm, getFieldProps, setFieldValue } = formik;

  const handleCollapseIn = () => {
    setShow((prev) => !prev);
  };

  const handleCollapseOut = () => {
    setShow(false);
  };

  const handleCancel = () => {
    onCancel();
    resetForm({
      values: {
        ...values,
        newCardName: '',
        newCardNumber: '',
        newCardExpired: '',
        newCardCvv: ''
      }
    });
  };

  return (
    <>
      <Paper
        sx={{
          p: 2.5,
          mb: 2.5,
          bgcolor: 'background.neutral'
        }}
      >
        <Stack spacing={2}>
          <Typography variant="subtitle1">Add new Test Case</Typography>
          <TextField
            fullWidth
            size="small"
            label="Test Case ID"
            {...getFieldProps('testCaseID')}
            error={Boolean(touched.testCaseID && errors.testCaseID)}
            helperText={touched.testCaseID && errors.testCaseID}
          />
          <TextField
            fullWidth
            size="small"
            label="Test Case Title"
            {...getFieldProps('testCaseTitle')}
            error={Boolean(touched.testCaseTitle && errors.testCaseTitle)}
            helperText={touched.testCaseTitle && errors.testCaseTitle}
          />
          <TextField
            fullWidth
            multiline
            size="small"
            minRows={3}
            maxRows={5}
            label="Test Case Description"
            {...getFieldProps('testDesc')}
            error={Boolean(touched.testDesc && errors.testDesc)}
            helperText={touched.testDesc && errors.testDesc}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField size="small" fullWidth label="Depends On" {...getFieldProps('dependsOn')} />
            <TextField
              select
              fullWidth
              size="small"
              label="Priority"
              placeholder="Priority"
              {...getFieldProps('priority')}
              SelectProps={{ native: true }}
            >
              <option value="" />
              {PRIORITY_OPTION.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </TextField>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Autocomplete
              fullWidth
              multiple
              freeSolo
              size="small"
              value={values.tags}
              onChange={(event, newValue) => {
                setFieldValue('tags', newValue);
              }}
              options={TAGS_OPTION.map((option) => option)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip key={option} size="small" label={option} {...getTagProps({ index })} />
                ))
              }
              renderInput={(params) => <TextField label="Tags" {...params} />}
            />
          </Stack>
          <div>
            <LabelStyle>Test Case Steps</LabelStyle>
            <Button
              id="addNewCard"
              type="button"
              size="small"
              startIcon={<Icon icon={plusFill} width={20} height={20} />}
              onClick={handleCollapseIn}
              sx={{ my: 1 }}
            >
              Add new Test Step
            </Button>
            <Collapse in={show}>
              <JsonNewStepForm formik={formik} onCancel={handleCollapseOut} />
            </Collapse>
          </div>
          <Stack direction="row" spacing={2}>
            <Button id="cancel" type="button" fullWidth onClick={handleCancel}>
              Cancel
            </Button>

            <Button id="create" type="button" fullWidth variant="contained">
              Add
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </>
  );
}
