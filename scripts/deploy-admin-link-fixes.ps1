# Run from the repository root after `git pull --ff-only` on the reviewed branch.
# Authenticate locally with `npx supabase login`; never put a token in this file.
$ErrorActionPreference = 'Stop'
$project = 'nttspzlszckaxjsjdlqi'
$branch = git branch --show-current
if ($LASTEXITCODE -ne 0 -or $branch -ne 'arena/8b4b1ec0-getyere') {
    throw 'Use the reviewed arena/8b4b1ec0-getyere branch.'
}
$dirty = git status --porcelain
if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Commit or review local changes before deploying.' }
$functions = @(
    'admin-session-create', 'admin-me', 'admin-session-revoke',
    'admin-overview', 'admin-users-list', 'admin-user-detail', 'admin-user-action',
    'admin-reminders-list', 'admin-reminder-detail', 'admin-reminder-action',
    'admin-notification-list', 'admin-support-list', 'admin-support-update',
    'admin-settings', 'admin-audit-list', 'admin-admin-list', 'admin-admin-invite',
    'admin-admin-role-update', 'admin-admin-session-revoke', 'dispatch-reminders'
)
foreach ($function in $functions) {
    Write-Host "Deploying $function to existing production project $project"
    # config.toml keeps admin JWT verification on and dispatch JWT verification off.
    # The dispatcher itself still requires the existing x-yere-cron-secret header.
    npx.cmd supabase functions deploy $function --project-ref $project --use-api
    if ($LASTEXITCODE -ne 0) { throw "Deployment failed at $function. Stop and inspect its error." }
}
Write-Host 'Deployments finished. Test super-admin login, regular-admin MFA, and a NEW reminder email.'
