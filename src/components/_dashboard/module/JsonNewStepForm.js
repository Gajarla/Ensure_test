import PropTypes from 'prop-types';
// material
import { Paper, Stack, TextField, Typography } from '@mui/material';
//

// ----------------------------------------------------------------------

JsonNewStepForm.propTypes = {
  formik: PropTypes.object,
  onCancel: PropTypes.func
};

const PRIORITY_OPTION = ['P1', 'P2', 'P3'];

export default function JsonNewStepForm({ formik }) {
  const { getFieldProps } = formik;

  return (
    <>
      <Paper
        sx={{
          p: 2.5,
          mb: 2.5,
          bgcolor: '#e9ebee'
        }}
      >
        <Stack spacing={2}>
          <Typography variant="subtitle1">Add new Test Step</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              fullWidth
              size="small"
              label="Step Type"
              placeholder="Select Step Type"
              {...getFieldProps('stepType')}
              SelectProps={{ native: true }}
            >
              <option value="" />
              {PRIORITY_OPTION.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              size="small"
              label="select"
              placeholder="Select..."
              {...getFieldProps('variant')}
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
        </Stack>
      </Paper>
    </>
  );
}
