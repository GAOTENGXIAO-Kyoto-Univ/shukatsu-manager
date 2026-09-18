# AGENTS.md

Follow the project-level instructions in `../AGENTS.md`.

Before changing Expo-specific code, check the exact versioned docs for the
currently installed Expo SDK.

## Backup Compatibility Rule

Whenever persisted data modeling or backup-visible semantics change, determine
whether the change is incompatible with an existing backup format. If it is
clearly incompatible, increment `CURRENT_BACKUP_VERSION` and add the next
sequential migration from the immediately preceding version. The first future
migration after Backup V2 must therefore be `v2ToV3`.

If it is unclear whether a version increment is required, stop and ask the user.
Do not silently change the backup format while keeping the old version, and do
not remove migrations for versions that remain supported. Ordinary UI changes
and unrelated query or aggregation changes do not require a backup version
increment.
