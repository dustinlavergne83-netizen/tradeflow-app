# Supabase CLI Installation Summary

## What Was Done

The issue with `npm install -g supabase` occurred because Supabase CLI no longer supports global npm installation. Instead, we installed it using **Scoop package manager**, which is the recommended method for Windows.

## Installation Steps Completed

1. ✅ Set PowerShell execution policy
2. ✅ Installed Scoop package manager
3. ✅ Added Supabase bucket to Scoop
4. ✅ Installed Supabase CLI version 2.67.1

## How to Use Supabase CLI

### First Time Setup
1. **Open a NEW terminal/PowerShell window** (to refresh your PATH)
2. Test the installation:
   ```powershell
   supabase --version
   ```
   You should see: `2.67.1`

### If Command Not Found
If `supabase` command is not recognized, you can use the full path:
```powershell
C:\Users\dusti\scoop\shims\supabase.exe --version
```

Or add it to your current session:
```powershell
$env:Path += ";C:\Users\dusti\scoop\shims"
```

## Common Supabase CLI Commands

```powershell
# Initialize a new Supabase project
supabase init

# Start local Supabase (Docker required)
supabase start

# Stop local Supabase
supabase stop

# Link to remote project
supabase link --project-ref your-project-ref

# Push migrations to remote
supabase db push

# Pull schema from remote
supabase db pull

# Generate TypeScript types
supabase gen types typescript

# Deploy functions
supabase functions deploy function-name
```

## Updating Supabase CLI

To update to the latest version in the future:
```powershell
scoop update supabase
```

## Managing Scoop (Your New Package Manager)

```powershell
# Update all installed packages
scoop update *

# List installed packages
scoop list

# Search for packages
scoop search package-name

# Uninstall a package
scoop uninstall package-name
```

## Troubleshooting

### Command Not Found After Installation
- Close and reopen your terminal
- Or restart VS Code
- The PATH should be updated automatically

### Need to Use Full Path
If the command still doesn't work, you can always use:
```powershell
C:\Users\dusti\scoop\shims\supabase.exe [command]
```

## Documentation Links

- Supabase CLI Docs: https://supabase.com/docs/guides/cli
- Scoop Package Manager: https://scoop.sh
- Supabase GitHub: https://github.com/supabase/cli

---

**Installation Date:** December 29, 2025
**Supabase CLI Version:** 2.67.1
**Installation Method:** Scoop Package Manager
