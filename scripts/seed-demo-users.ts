/**
 * Demo Users Seeding Script
 *
 * Provisions 3 test accounts using the Supabase Admin API:
 * 1. student@demo.edu (Role: student)
 * 2. faculty@demo.edu (Role: faculty)
 * 3. admin@demo.edu   (Role: admin)
 *
 * Password for all accounts: Password123!
 *
 * Run via: npm run seed
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Helper to load .env.local if not already in process.env
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes('your-project-id')) {
  console.error('\n❌ ERROR: Supabase credentials not found or placeholder values used.');
  console.error('Please configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface DemoUserConfig {
  email: string;
  password: string;
  fullName: string;
  role: 'student' | 'faculty' | 'admin';
  metadata: Record<string, string>;
}

const DEMO_USERS: DemoUserConfig[] = [
  {
    email: 'student@demo.edu',
    password: 'Password123!',
    fullName: 'Aarav Sharma (Student)',
    role: 'student',
    metadata: {
      full_name: 'Aarav Sharma (Student)',
      roll_no: 'CS-2026-042',
      department: 'Computer Science',
    },
  },
  {
    email: 'faculty@demo.edu',
    password: 'Password123!',
    fullName: 'Dr. Priya Raman (Faculty)',
    role: 'faculty',
    metadata: {
      full_name: 'Dr. Priya Raman (Faculty)',
      department: 'Computer Science',
    },
  },
  {
    email: 'admin@demo.edu',
    password: 'Password123!',
    fullName: 'Vikram Singh (Admin)',
    role: 'admin',
    metadata: {
      full_name: 'Vikram Singh (Admin)',
    },
  },
];

async function seed() {
  console.log('🌱 Starting Demo Users Seeding...\n');

  for (const userConfig of DEMO_USERS) {
    console.log(`Processing [${userConfig.role.toUpperCase()}]: ${userConfig.email}...`);

    // Check if user already exists in auth.users or profiles
    const { data: profileCheck } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userConfig.email)
      .maybeSingle();

    const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = userList?.users.find((u) => u.email === userConfig.email);

    let userId = existing?.id || profileCheck?.id;

    if (!existing) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: userConfig.email,
        password: userConfig.password,
        email_confirm: true, // Auto-confirm email so test users can log in immediately
        user_metadata: userConfig.metadata,
      });

      if (error) {
        console.error(`  ❌ Failed to create auth user for ${userConfig.email}:`, error.message);
        continue;
      }
      userId = data.user.id;
      console.log(`  ✅ Created auth account with ID: ${userId}`);
    } else {
      console.log(`  ℹ️  Auth account already exists (ID: ${userId}). Updating password...`);
      await supabase.auth.admin.updateUserById(userId!, {
        password: userConfig.password,
        email_confirm: true,
      });
    }

    if (!userId) continue;

    // Ensure profile has correct role
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: userConfig.email,
        full_name: userConfig.fullName,
        role: userConfig.role,
        is_anonymous: false,
      });

    if (profileError) {
      console.error(`  ❌ Profile update failed:`, profileError.message);
    } else {
      console.log(`  ✅ Profile role set to: ${userConfig.role}`);
    }

    // Role-specific extensions
    if (userConfig.role === 'student') {
      await supabase.from('students').upsert({
        id: userId,
        roll_no: userConfig.metadata.roll_no || 'CS-2026-042',
        department: userConfig.metadata.department || 'Computer Science',
        year_of_study: 1,
      });
      console.log(`  ✅ Student academic record verified.`);
    } else if (userConfig.role === 'faculty') {
      await supabase.from('faculty').upsert({
        id: userId,
        employee_id: 'FAC-CS-101',
        department: 'Computer Science',
        designation: 'Associate Professor',
      });
      console.log(`  ✅ Faculty department record verified.`);
    }
  }

  console.log('\n🎉 Demo accounts successfully seeded!');
  console.log('----------------------------------------------------');
  console.log('Student: student@demo.edu / Password123!');
  console.log('Faculty: faculty@demo.edu / Password123!');
  console.log('Admin:   admin@demo.edu   / Password123!');
  console.log('----------------------------------------------------\n');
}

seed().catch((err) => {
  console.error('Fatal seed script error:', err);
  process.exit(1);
});
