# Git Workflow (Proyecto X)

## Objetivo

Mantener commits pequeños, fáciles de revisar y fáciles de revertir.

## Reglas prácticas

- **Commits pequeños**: una intención por commit.
- **Antes de empezar**: `pull --ff-only` para evitar merges accidentales.
- **Antes de cambios grandes**: commit “checkpoint” para poder volver atrás.
- **Nada generado en Git**: `node_modules/`, `uploads/`, `*.db`, etc. deben quedar ignorados.

## Flujo diario recomendado

### 1) Actualiza tu rama

```bash
git status
git pull --ff-only
```

### 2) Trabaja en una rama (recomendado)

```bash
git checkout -b feat/nombre-corto
```

### 3) Revisa cambios y agrega de forma selectiva

```bash
git status
git diff
git add -p
```

### 4) Commit

- Usa mensajes tipo: `type(scope): resumen`
- Tipos sugeridos:
  - `feat`, `fix`, `docs`, `chore`, `refactor`, `test`

```bash
git commit
```

### 5) Push

```bash
git push -u origin HEAD
```

### 6) Integrar a main

Si trabajas con PR: crea PR y merge en GitHub.

Si haces merge local:

```bash
git checkout main
git pull --ff-only
git merge --no-ff feat/nombre-corto
git push
```

## “Checkpoint commits” (antes de refactors grandes)

```bash
git add -A
git commit -m "chore: checkpoint before refactor"
```

## Cómo revertir / deshacer

### Revertir un commit (seguro, recomendado si ya hiciste push)

```bash
git revert <hash>
```

### Deshacer cambios no commiteados

- Descartar cambios en archivos trackeados:

```bash
git restore .
```

- Guardar temporalmente (stash):

```bash
git stash push -u -m "wip"
```

### Volver a un commit anterior (peligroso si ya hiciste push)

```bash
git reset --hard <hash>
```

## Tips

- Antes de `push`, confirma:

```bash
git status
git log -n 5 --oneline --decorate --graph
```

- Si GitHub pide credenciales: usa **Personal Access Token** (PAT) como password.
