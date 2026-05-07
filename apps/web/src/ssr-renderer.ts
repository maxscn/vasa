import { fetchViteEnv } from "nitro/vite/runtime";

export default function ssrRenderer({ req }: { req: Request }) {
  return fetchViteEnv("ssr", req);
}
