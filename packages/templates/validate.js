const fs = require('fs');
const path = require('path');

const REQUIRED_FIELDS = ['id', 'name', 'description', 'categories', 'roles'];
const VALID_CHANNEL_TYPES = ['text', 'voice', 'stage', 'forum', 'announcement'];

let errors = 0;
let warnings = 0;

function validate(filePath) {
  const name = path.basename(filePath);
  console.log(`\nValidating ${name}...`);

  const raw = fs.readFileSync(filePath, 'utf-8');
  const template = JSON.parse(raw);

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (!template[field]) {
      console.error(`  ❌ Missing required field: ${field}`);
      errors++;
    }
  }

  // Categories
  if (template.categories) {
    let totalChannels = 0;
    for (const cat of template.categories) {
      if (!cat.name) { console.error(`  ❌ Category missing name`); errors++; }
      if (!cat.channels || !Array.isArray(cat.channels)) {
        console.error(`  ❌ Category "${cat.name}" missing channels array`); errors++;
        continue;
      }
      for (const ch of cat.channels) {
        totalChannels++;
        if (!ch.name) { console.error(`  ❌ Channel missing name in "${cat.name}"`); errors++; }
        if (!ch.type) { console.error(`  ❌ Channel "${ch.name}" missing type`); errors++; }
        if (ch.type && !VALID_CHANNEL_TYPES.includes(ch.type)) {
          console.error(`  ❌ Channel "${ch.name}" invalid type: ${ch.type}`);
          errors++;
        }
        if (ch.slowmode && (ch.slowmode < 0 || ch.slowmode > 21600)) {
          console.warn(`  ⚠️ Channel "${ch.name}" slowmode out of range (0-21600)`);
          warnings++;
        }
        if (ch.user_limit && (ch.user_limit < 0 || ch.user_limit > 99)) {
          console.warn(`  ⚠️ Channel "${ch.name}" user_limit out of range (0-99)`);
          warnings++;
        }
      }
    }
    console.log(`  📊 ${template.categories.length} categories, ${totalChannels} channels`);
  }

  // Roles
  if (template.roles) {
    for (const role of template.roles) {
      if (!role.name) { console.error(`  ❌ Role missing name`); errors++; }
      if (!role.color) { console.error(`  ❌ Role "${role.name}" missing color`); errors++; }
      if (role.color && !/^#[0-9A-Fa-f]{6}$/.test(role.color)) {
        console.error(`  ❌ Role "${role.name}" invalid color: ${role.color}`);
        errors++;
      }
    }
    console.log(`  👥 ${template.roles.length} roles`);
  }

  console.log(`  ✅ Validation complete`);
}

// Run
const templatesDir = __dirname;
const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.json') && !f.startsWith('_') && f !== 'package.json');

for (const file of files) {
  validate(path.join(templatesDir, file));
}

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${errors} errors, ${warnings} warnings`);
if (errors > 0) {
  console.error('❌ Validation FAILED');
  process.exit(1);
} else {
  console.log('✅ All templates valid!');
}
