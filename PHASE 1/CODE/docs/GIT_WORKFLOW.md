# MIDISense — Git Branching Workflow

## The rule: never all edit `main` directly

`main` is the stable, working version. Each person does their work on their own branch, then merges back in when it's ready and tested.

## One-time setup (each teammate does this once)

```bash
# Clone the repo (first time only)
git clone https://github.com/YOUR-USERNAME/midisense.git
cd midisense
```

## Daily workflow (everyone follows this every session)

### 1. Start of session — get the latest code
```bash
git checkout main
git pull
```

### 2. Create or switch to your own branch

**Person A (MIDI + analysis engine):**
```bash
git checkout -b midi-analysis
```

**Person B (LLM tutor):**
```bash
git checkout -b llm-tutor
```

**Person C (UI + sequencer):**
```bash
git checkout -b ui-sequencer
```

(After the first time, just use `git checkout midi-analysis` etc. to switch back to your existing branch.)

### 3. Do your work, then save it in small chunks
```bash
git add .
git commit -m "Add timing deviation calculation to analysis engine"
```
Commit often, with clear messages — small, frequent commits are much easier to review and undo than one giant commit at the end of the week.

### 4. Push your branch to GitHub
```bash
git push -u origin midi-analysis
```
(Only need `-u origin midi-analysis` the first push; after that just `git push`.)

### 5. Open a Pull Request (PR) when a feature is ready
On GitHub.com:
1. Go to your repo → you'll see a banner "midi-analysis had recent pushes" → click **Compare & pull request**
2. Add a short description of what you built
3. Click **Create pull request**
4. Tag your teammates to review (or just merge yourself for a 3-person student project — but at least glance at the diff first)

### 6. Merge into `main`
Once it looks good, click **Merge pull request** on GitHub. Then locally:
```bash
git checkout main
git pull
```

## What to do if there's a conflict

Git will tell you exactly which file(s) conflict. Open the file — Git marks the conflicting sections with `<<<<<<<`, `=======`, `>>>>>>>`. Manually decide which version (or a combination) is correct, delete the marker lines, save, then:
```bash
git add .
git commit -m "Resolve merge conflict"
git push
```

## Quick reference

| Command | What it does |
|---|---|
| `git status` | Shows what's changed, uncommitted |
| `git pull` | Gets the latest code from GitHub |
| `git checkout -b <name>` | Creates and switches to a new branch |
| `git add .` | Stages all changed files |
| `git commit -m "message"` | Saves a checkpoint locally |
| `git push` | Uploads your commits to GitHub |
| `git log --oneline` | Shows commit history |
