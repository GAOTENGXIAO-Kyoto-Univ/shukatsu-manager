# shukatsu-manager

Mobile-first job-hunting management app skeleton.

## Setup

Install dependencies:

```bash
npm install
```

Create local environment values:

```bash
cp .env.example .env.local
```

Required variables:

```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
EXPO_PUBLIC_CONVEX_URL=
```

## Development

Start the Web development server:

```bash
npx expo start --web
```

Run validation:

```bash
npm run lint
npx tsc --noEmit
npx expo export --platform web
```
