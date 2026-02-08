import bcrypt from "bcrypt";

/**
 * Generate bcrypt hash for a password
 * Usage: node generate-password-hash.js
 */
async function generateHash() {
  const password = process.argv[2] || "admin123";
  const saltRounds = 10;

  console.log(`\n🔐 Generating hash for password: "${password}"\n`);

  const hash = await bcrypt.hash(password, saltRounds);

  console.log(`Hash: ${hash}\n`);
  console.log(`To update the migration file, replace the password_hash value with:`);
  console.log(`'${hash}'\n`);

  // Verify it works
  const isValid = await bcrypt.compare(password, hash);
  console.log(`✅ Verification: ${isValid ? "SUCCESS" : "FAILED"}\n`);
}

generateHash().catch(console.error);
