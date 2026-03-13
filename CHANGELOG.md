# Changelog

All notable changes to this project will be documented in this file.

## [1.0.2] - 2026-03-13

### Fixed
- Fixed typo in extensions directory name (`extentions` → `extensions`) that caused the extension code to be excluded from the published npm tarball
- Fixed `pi.extensions` path in package.json to match the corrected directory name
- Added `pi-package` keyword required for discoverability in the pi extensions gallery

## [1.0.1] - 2026-03-13

### Fixed
- Bug fixes and improvements

## [1.0.0] - 2026-03-12

### Added
- Initial release of pi-load-skill extension
- Load skills on-demand from any file path or directory
- Load individual skills or all skills from a directory
- Session-scoped skill loading (skills available only for current session)
- Temporary persistence through reloads (skills restored when reloading, cleared on fresh start)
- Unload skills functionality
- List loaded skills command
- Compatible with pi >= 0.50.0
