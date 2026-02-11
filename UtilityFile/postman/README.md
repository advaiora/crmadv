# Checklists/Gate Postman Suite (Fase 5)

Collection file: `UtilityFile/postman/checklists-gate-phase5.postman_collection.json`

## Variables to set before run
- `baseUrl` (default `http://localhost:4000`)
- `userId`, `userEmail`, `workspaceId`
- `limitedUserId`, `limitedUserEmail`
- `otherWorkspaceId`
- `projectId`, `pipelineStageId`, `gatedStageId`

## Notes
- Run `Setup - Disable checklists module` before test **5.3**, then `Setup - Enable checklists module` after.
- Tests **5.14/5.15/5.16** require a real gated stage configured via `StageChecklistRule`.
- Test **5.17** requires a resource created in a different workspace.
