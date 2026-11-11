import './env';

export const APP_BASE_URL = process.env.HHM_API_BASE_URL ?? "http://localhost:3000";
export const EXECUTION_TIMEOUT = 150000;
export const EXPECT_TIMEOUT = 60000;
export const ACTION_TIMEOUT = 40000;
export const RETRY_COUNT = 1;
export const NWORKERS = 4;
export const SOAK_DURATION_MINUTES = 1;
