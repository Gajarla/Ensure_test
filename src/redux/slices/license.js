import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  licenseExpired: false
};

const slice = createSlice({
  name: 'license',
  initialState,
  reducers: {
    setLicenseStatus(state, action) {
      state.licenseExpired = action.payload.licenseExpired;
    },
    clearLicenseStatus(state) {
      state.licenseExpired = false;
    }
  }
});

export const { setLicenseStatus, clearLicenseStatus } = slice.actions;

export default slice.reducer;
