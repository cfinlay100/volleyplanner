# Git profile setup

This project uses Git’s **conditional includes** so different identities are used automatically by directory.

## Profiles

| Directory        | Profile | Email                               |
|-----------------|---------|--------------------------------------|
| `~/projects/`   | Hobby   | `cfinlay100@users.noreply.github.com` |
| `~/work/`       | Work    | `chris.finlay@zango.com.au`          |
| Other paths     | Fallback| Work identity                        |

## Files

- `~/.gitconfig` — Main config with `includeIf` rules
- `~/.gitconfig-hobby` — Hobby identity
- `~/.gitconfig-work` — Work identity

## Changing hobby email

Edit `~/.gitconfig-hobby`. Current value is GitHub’s no-reply address; you can switch to a personal email if you prefer.

## Changing directory paths

Edit `~/.gitconfig` and adjust the `gitdir:` paths, e.g.:

```gitconfig
[includeIf "gitdir:~/projects/"]
  path = ~/.gitconfig-hobby

[includeIf "gitdir:~/work/"]
  path = ~/.gitconfig-work
```

Trailing `/` is required so subdirectories match.
