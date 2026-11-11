import './env';

export const APP_BASE_URL = process.env.HHM_API_BASE_URL ?? "http://localhost:3000";
export const EXECUTION_TIMEOUT = 150000;
export const EXPECT_TIMEOUT = 60000;
export const ACTION_TIMEOUT = 40000;
export const RETRY_COUNT = 1;
export const NWORKERS = 4;
export const SOAK_DURATION_MINUTES = 1;

/**
 * Removes test data that the API cannot delete (see src/api/clients/collections.ts)
 * directly in the database. Set to false to run without database access: that
 * data, and the people registered by the scenarios that created it, are kept.
 * They keep the test data prefix, so the sweep removes them once cleanup is
 * enabled again.
 */
export const DATABASE_CLEANUP = true;

/**
 * MongoDB behind the API under test, built from the same MONGO_* variables and
 * in the same way as the HHM backend (backend/src/config/database.ts), so the
 * backend `.env` file can be used unchanged.
 */
const { MONGO_HOST, MONGO_PORT, MONGO_DATABASE, MONGO_USER, MONGO_PASSWORD } = process.env;
const MONGO_CREDENTIALS = MONGO_USER && MONGO_PASSWORD ? `${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASSWORD)}@` : '';

export const MONGO_URI = MONGO_HOST && MONGO_PORT && MONGO_DATABASE
  ? `mongodb://${MONGO_CREDENTIALS}${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}?authSource=${MONGO_DATABASE}`
  : undefined;

/** The database URI with its credentials hidden, safe for logs and error messages. */
export const MONGO_URI_MASKED = MONGO_URI?.replace(/\/\/[^@/]+@/, '//***:***@');
