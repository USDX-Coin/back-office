#!/usr/bin/env bash
# One-shot migration from Azure Horizon tokens to shadcn-minimal tokens.
# Idempotent — safe to run multiple times. Delete this file after the merge.

set -euo pipefail

# All substitutions batched into a single sed invocation per file.
# Order matters: most specific variants first.
SCRIPT='
s/\bbg-surface-container-lowest\b/bg-card/g
s/\bbg-surface-container-low\b/bg-muted\/40/g
s/\bbg-surface-container-highest\b/bg-muted/g
s/\bbg-surface-container-high\b/bg-muted/g
s/\bbg-surface-container\b/bg-muted\/60/g
s/\bbg-surface\b/bg-background/g

s/\btext-on-surface-variant\b/text-muted-foreground/g
s/\bbg-on-surface-variant\b/bg-muted/g
s/\btext-on-surface\b/text-foreground/g
s/\bbg-on-surface\b/bg-foreground/g
s/\btext-on-primary-fixed-variant\b/text-primary/g
s/\btext-on-primary\b/text-primary-foreground/g
s/\bbg-on-primary\b/bg-primary-foreground/g

s/\bhover:bg-primary-container\b/hover:bg-primary/g
s/\bhover:text-primary-container\b/hover:text-primary/g
s/\bhover:border-primary-container\b/hover:border-primary/g
s/\bbg-primary-container\b/bg-primary/g
s/\btext-primary-container\b/text-primary/g
s/\bborder-primary-container\b/border-primary/g
s/\bring-primary-container\b/ring-primary/g
s/\bfrom-primary-container\b/from-primary/g
s/\bto-primary-container\b/to-primary/g
s/\bvia-primary-container\b/via-primary/g

s/\bhover:bg-primary-dark\b/hover:bg-primary\/90/g
s/\bbg-primary-dark\b/bg-primary/g
s/\btext-primary-dark\b/text-primary/g
s/\bbg-primary-light\b/bg-primary\/10/g
s/\btext-primary-light\b/text-primary/g

s/\bbg-secondary-container\b/bg-secondary/g
s/\btext-secondary-container\b/text-secondary-foreground/g
s/\bborder-secondary-container\b/border-border/g
s/\bbg-tertiary-container\b/bg-warning\/20/g
s/\btext-tertiary-container\b/text-warning/g
s/\bborder-tertiary-container\b/border-warning\/30/g
s/\bbg-tertiary\b/bg-warning/g
s/\btext-tertiary\b/text-warning/g
s/\bborder-tertiary\b/border-warning/g

s/\btext-secondary\b/text-secondary-foreground/g
s/\bborder-secondary\b/border-border/g

s/\bborder-outline-variant\b/border-border/g
s/\bborder-outline\b/border-border/g
s/\btext-outline-variant\b/text-muted-foreground/g
s/\btext-outline\b/text-muted-foreground/g
s/\bring-outline-variant\b/ring-border/g
s/\bbg-outline-variant\b/bg-border/g
s/\bbg-outline\b/bg-border/g
s/\bdivide-outline-variant\b/divide-border/g
s/\bdivide-outline\b/divide-border/g
s/\bring-offset-surface\b/ring-offset-background/g

s/\bhover:bg-error\b/hover:bg-destructive/g
s/\bhover:text-error\b/hover:text-destructive/g
s/\bhover:border-error\b/hover:border-destructive/g
s/\bfocus:border-error\b/focus:border-destructive/g
s/\bfocus:ring-error\b/focus:ring-destructive/g
s/\bbg-error\b/bg-destructive/g
s/\btext-error\b/text-destructive/g
s/\bborder-error\b/border-destructive/g
s/\bring-error\b/ring-destructive/g

s/\bbg-blue-pulse\b/bg-primary/g
s/\bghost-border-focus\b/focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/g
s/\bghost-border\b/border border-border\/40/g
s/\bshadow-ambient-sm\b/shadow-sm/g
s/\bshadow-ambient\b/shadow-sm/g

s/ font-display//g
s/font-display //g
s/\bfont-display\b//g
'

find src -type f \( -name '*.tsx' -o -name '*.ts' \) -print0 \
  | xargs -0 -I{} sed -i -E "$SCRIPT" {}

echo "Migration pass complete."
