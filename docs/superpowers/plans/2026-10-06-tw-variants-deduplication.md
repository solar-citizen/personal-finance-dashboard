# Tailwind Variants Button & Switcher De-duplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De-duplicate recurring button and switcher patterns across the web application using `tailwind-variants`, extracting reusable `CloseButton`, `SegmentedControl`, and `LanguageOptionButton` components, and updating consumers.

**Architecture:** Create dedicated common and feature components styled with `tailwind-variants` (`tv()`) recipes to replace inline raw button markup and duplicated styling across `PrivatBankUploadModal`, `ChatWindow`, `PeriodSwitcher`, `AccountAllocationBarChart`, `LanguageSwitcher`, and `AccountsSummary`.

**Tech Stack:** Next.js 14 App Router, React 19, Tailwind CSS v4, `tailwind-variants`.

## Global Constraints

- Use `tailwind-variants` (`tv()`) for all new variant and slot styling.
- All design tokens must come from `globals.css` via semantic CSS classes (`bg-primary`, `text-muted-foreground`, `border-border`, etc.) — no raw hex, no hardcoded colors.
- Follow `apps/web/CLAUDE.md` rules: default exports for components, explicit string syntax for JSX text and string attributes (`type={'button'}`).
- Verify changes after each task using TypeScript compilation (`bun run --cwd apps/web build`).

---

### Task 1: Create `CloseButton` component and update modal & chat window

**Files:**
- Create: `apps/web/src/components/common/CloseButton.tsx`
- Modify: `apps/web/src/components/privatbank/PrivatBankUploadModal.tsx:132-142`
- Modify: `apps/web/src/components/ai-chat/ChatWindow.tsx:275-285`

**Interfaces:**
- Produces:
  ```ts
  type CloseButtonProps = React.ComponentProps<'button'>;
  export default function CloseButton(props: CloseButtonProps): React.JSX.Element;
  ```

- [ ] **Step 1: Create `apps/web/src/components/common/CloseButton.tsx`**

```tsx
import { tv } from 'tailwind-variants';

const closeButton = tv({
  base: 'text-muted-foreground hover:text-destructive transition-colors cursor-pointer',
});

type CloseButtonProps = React.ComponentProps<'button'>;

export default function CloseButton({ className, ...props }: CloseButtonProps) {
  return (
    <button
      type={'button'}
      className={closeButton({ className })}
      {...props}
    >
      {'✕'}
    </button>
  );
}
```

- [ ] **Step 2: Update `PrivatBankUploadModal.tsx` to use `CloseButton`**

Import `CloseButton` from `../common/CloseButton` and replace lines 132-141:
```tsx
<CloseButton
  onClick={handleClose}
  title={t('privatbank.closeModal')}
  aria-label={t('privatbank.closeModal')}
  className={'absolute top-4 right-4'}
/>
```

- [ ] **Step 3: Update `ChatWindow.tsx` to use `CloseButton`**

Import `CloseButton` from `../common/CloseButton` and replace lines 275-284:
```tsx
<CloseButton
  onClick={onHide}
  title={t('aiChat.hideChat')}
  aria-label={t('aiChat.hideChat')}
/>
```

- [ ] **Step 4: Verify compilation**

Run: `bun run --cwd apps/web build`
Expected: Compiled successfully with 0 errors.

- [ ] **Step 5: Commit changes**

```bash
git add apps/web/src/components/common/CloseButton.tsx apps/web/src/components/privatbank/PrivatBankUploadModal.tsx apps/web/src/components/ai-chat/ChatWindow.tsx
git commit -m "feat(web): extract CloseButton and update PrivatBankUploadModal and ChatWindow"
```

---

### Task 2: Create `SegmentedControl` and update `PeriodSwitcher` and `AccountAllocationBarChart`

**Files:**
- Create: `apps/web/src/components/common/SegmentedControl.tsx`
- Modify: `apps/web/src/components/dashboard/PeriodSwitcher.tsx`
- Modify: `apps/web/src/components/transactions/charts/AccountAllocationBarChart.tsx:113-128`

**Interfaces:**
- Produces:
  ```ts
  type SegmentedControlProps = React.ComponentProps<'div'>;
  export default function SegmentedControl(props: SegmentedControlProps): React.JSX.Element;

  type SegmentedButtonProps = React.ComponentProps<'button'> & {
    active?: boolean;
  };
  export function SegmentedButton(props: SegmentedButtonProps): React.JSX.Element;
  ```

- [ ] **Step 1: Create `apps/web/src/components/common/SegmentedControl.tsx`**

```tsx
import { tv } from 'tailwind-variants';

const segmentedControl = tv({
  slots: {
    root: 'flex gap-1 bg-secondary p-1 rounded-lg text-xs',
    button: 'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
  },
  variants: {
    active: {
      true: {
        button: 'bg-primary text-primary-foreground shadow-sm',
      },
      false: {
        button: 'text-muted-foreground hover:text-foreground',
      },
    },
  },
  defaultVariants: {
    active: false,
  },
});

type SegmentedControlProps = React.ComponentProps<'div'>;

export default function SegmentedControl({
  className,
  children,
  ...props
}: SegmentedControlProps) {
  const { root } = segmentedControl();

  return (
    <div className={root({ className })} {...props}>
      {children}
    </div>
  );
}

type SegmentedButtonProps = React.ComponentProps<'button'> & {
  active?: boolean;
};

export function SegmentedButton({
  active,
  className,
  children,
  ...props
}: SegmentedButtonProps) {
  const { button } = segmentedControl();

  return (
    <button
      type={'button'}
      className={button({ active, className })}
      {...props}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Update `PeriodSwitcher.tsx` to use `SegmentedControl` & `SegmentedButton`**

Rewrite `PeriodSwitcher.tsx` to consume `SegmentedControl` and `SegmentedButton`:
```tsx
'use client';

import { type Period, periods } from '@pfd/shared';
import { useTranslation } from 'react-i18next';

import SegmentedControl, { SegmentedButton } from '../common/SegmentedControl';

type PeriodSwitcherProps = {
  value: Period;
  onChange: (period: Period) => void;
};

const periodKeys: Record<Period, string> = {
  day: 'periods.day',
  week: 'periods.week',
  month: 'periods.month',
  year: 'periods.year',
  '5years': 'periods.fiveYears',
};

export default function PeriodSwitcher({
  value,
  onChange,
}: PeriodSwitcherProps) {
  const { t } = useTranslation();

  return (
    <SegmentedControl>
      {periods.map(p => (
        <SegmentedButton
          key={p}
          active={value === p}
          onClick={() => onChange(p)}
        >
          {t(periodKeys[p])}
        </SegmentedButton>
      ))}
    </SegmentedControl>
  );
}
```

- [ ] **Step 3: Update `AccountAllocationBarChart.tsx` to use `SegmentedControl` & `SegmentedButton`**

Import `SegmentedControl, { SegmentedButton }` from `../../common/SegmentedControl` and replace the raw currency buttons:
```tsx
          <SegmentedControl className={'self-start'}>
            {currencyOptions.map(currency => (
              <SegmentedButton
                key={currency}
                active={baseCurrency === currency}
                onClick={() => setBaseCurrency(currency)}
              >
                {currency}
              </SegmentedButton>
            ))}
          </SegmentedControl>
```

- [ ] **Step 4: Verify compilation**

Run: `bun run --cwd apps/web build`
Expected: Compiled successfully with 0 errors.

- [ ] **Step 5: Commit changes**

```bash
git add apps/web/src/components/common/SegmentedControl.tsx apps/web/src/components/dashboard/PeriodSwitcher.tsx apps/web/src/components/transactions/charts/AccountAllocationBarChart.tsx
git commit -m "feat(web): extract SegmentedControl and update PeriodSwitcher and AccountAllocationBarChart"
```

---

### Task 3: Extract `LanguageOptionButton` and update `LanguageSwitcher`

**Files:**
- Create: `apps/web/src/components/settings/LanguageOptionButton.tsx`
- Modify: `apps/web/src/components/settings/LanguageSwitcher.tsx`

**Interfaces:**
- Produces:
  ```ts
  type LanguageOptionButtonProps = React.ComponentProps<'button'> & {
    selected?: boolean;
  };
  export default function LanguageOptionButton(props: LanguageOptionButtonProps): React.JSX.Element;
  ```

- [ ] **Step 1: Create `apps/web/src/components/settings/LanguageOptionButton.tsx`**

```tsx
import { tv } from 'tailwind-variants';

const languageOption = tv({
  base: 'px-4 py-2 text-sm font-medium rounded-md border transition-colors cursor-pointer',
  variants: {
    selected: {
      true: 'bg-primary text-primary-foreground border-primary',
      false: 'bg-background text-foreground border-border hover:bg-muted',
    },
  },
  defaultVariants: {
    selected: false,
  },
});

type LanguageOptionButtonProps = React.ComponentProps<'button'> & {
  selected?: boolean;
};

export default function LanguageOptionButton({
  selected,
  className,
  children,
  ...props
}: LanguageOptionButtonProps) {
  return (
    <button
      type={'button'}
      className={languageOption({ selected, className })}
      {...props}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Update `LanguageSwitcher.tsx` to use `LanguageOptionButton`**

Update `apps/web/src/components/settings/LanguageSwitcher.tsx`:
```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { AppLanguage } from '#src/locales/types';

import LanguageOptionButton from './LanguageOptionButton';

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const currentLanguage: AppLanguage =
    i18n.language === ('uk' as const) ? AppLanguage.UK : AppLanguage.EN;

  const handleLanguageChange = (lng: AppLanguage) => {
    void i18n.changeLanguage(lng);
    document.cookie = `NEXT_LOCALE=${lng}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  };

  return (
    <div className={'flex flex-col gap-2'}>
      <label className={'text-sm font-medium text-foreground'}>
        {t('settings.language')}
      </label>
      <p className={'text-xs text-muted-foreground'}>
        {t('settings.languageSelect')}
      </p>
      <div className={'flex gap-2 mt-1'}>
        <LanguageOptionButton
          selected={currentLanguage === AppLanguage.EN}
          onClick={() => handleLanguageChange(AppLanguage.EN)}
        >
          {t('settings.english')}
        </LanguageOptionButton>
        <LanguageOptionButton
          selected={currentLanguage === AppLanguage.UK}
          onClick={() => handleLanguageChange(AppLanguage.UK)}
        >
          {t('settings.ukrainian')}
        </LanguageOptionButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify compilation**

Run: `bun run --cwd apps/web build`
Expected: Compiled successfully with 0 errors.

- [ ] **Step 4: Commit changes**

```bash
git add apps/web/src/components/settings/LanguageOptionButton.tsx apps/web/src/components/settings/LanguageSwitcher.tsx
git commit -m "feat(web): extract LanguageOptionButton and update LanguageSwitcher"
```

---

### Task 4: Update `AccountsSummary` import button to use `Button`

**Files:**
- Modify: `apps/web/src/components/dashboard/summary/AccountsSummary.tsx:83-93`

**Interfaces:**
- Consumes:
  ```ts
  import Button from '../../common/Button';
  ```

- [ ] **Step 1: Update `AccountsSummary.tsx`**

Import `Button from '../../common/Button'` and update the import button:
```tsx
        <Button
          type={'button'}
          variant={'outline'}
          size={'sm'}
          onClick={() => setIsUploadOpen(true)}
          className={'bg-secondary text-muted-foreground hover:text-foreground'}
        >
          <HardDriveUpload className={'inline-block size-3.5 mr-1.5 -mt-0.5'} />
          {t('privatbank.importButton')}
        </Button>
```

- [ ] **Step 2: Verify compilation and linting**

Run: `bun run lint && bun turbo build`
Expected: All lints and builds pass without errors.

- [ ] **Step 3: Commit changes**

```bash
git add apps/web/src/components/dashboard/summary/AccountsSummary.tsx
git commit -m "feat(web): use Button component in AccountsSummary"
```
