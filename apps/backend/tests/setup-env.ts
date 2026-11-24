process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  'postgresql://civicfix:civicfix_secret@localhost:5432/civicfix_db?schema=public';
process.env.JWT_ACCESS_SECRET =
  'civicfix_test_access_jwt_secret_at_least_32_chars';
process.env.JWT_REFRESH_SECRET =
  'civicfix_test_refresh_jwt_secret_at_least_32_chars';
