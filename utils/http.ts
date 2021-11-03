import axios, { AxiosRequestConfig, Canceler } from "axios";
import qs from "qs";
axios.defaults.timeout = 6000;
axios.defaults.headers["X-Requested-With"] = "XMLHttpRequest";
axios.defaults.headers["Content-Type"] = "application/json;charset=UTF-8";
export default {
  clientJSON(config: AxiosRequestConfig) {
    const defaultConfig = {
      headers: { "Content-Type": "application/json;charset=UTF-8" },
    };
    return axios(Object.assign(defaultConfig, config));
  },
  clientForm(config: AxiosRequestConfig) {
    const defaultConfig = {
      data: qs.stringify(config.data),
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      paramsSerializer: (params) => qs.stringify(params, { indices: false }),
    };
    return axios(Object.assign(defaultConfig, config));
  },
  clientFile(
    config: AxiosRequestConfig,
    handleProgressChange: (event: ProgressEvent) => any,
    receiveCanceler: (canceler: Canceler) => any
  ) {
    const defaultConfig = {
      timeout: 0,
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event: ProgressEvent) => event.lengthComputable && handleProgressChange(event),
      cancelToken: new axios.CancelToken((canceler) => receiveCanceler(canceler)),
    };
    return axios(Object.assign(defaultConfig, config));
  },
};
