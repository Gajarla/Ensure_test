// import axios from 'axios';
import axios from '../utils/axiosInstance';
import API from '../services';
import { getSessionObj } from '../utils/jwt';

export const getValidations = async () => {
  try {
    const response = await axios({
      method: 'get',
      url: `${API.validate.getValidations()}`,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    const data = response?.data[0];
    return data;
  } catch (error) {
    console.log('error = ', error);
  }
};
