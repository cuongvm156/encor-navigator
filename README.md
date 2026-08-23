# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start (full-stack React framework, Vite-based)
- TanStack Router — file-based routing in `src/routes` (**not** React Router)
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui + lucide-react

## Local audio smoke testing

No copyrighted audio is committed. To exercise the HTMLAudioElement engine
locally, copy `.env.example` to `.env.local` and set `VITE_DEMO_AUDIO_URL` to any
public MP3 URL. It is used only as a fallback when the selected chapter has no
valid audio URL in the course data; otherwise the player shows an "audio
unavailable" message.

## Docs

- [`PRD.md`](./PRD.md) — approved MVP V1 scope and screens
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — stack, layering and architecture rules
- [`AGENTS.md`](./AGENTS.md) — mandatory contribution rules
