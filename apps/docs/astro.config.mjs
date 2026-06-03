import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://optiflow.github.io",
  base: "/agent-memory-os",
  integrations: [
    starlight({
      title: "Agent Memory OS",
      sidebar: [
        {
          label: "Start",
          items: [
            { label: "Overview", link: "/" },
            { slug: "start/getting-started" },
            { slug: "start/environment" },
          ],
        },
        {
          label: "Architecture",
          items: [{ slug: "architecture/architecture" }, { slug: "architecture/data-model" }],
        },
        {
          label: "Reference",
          items: [{ slug: "reference/cli-reference" }, { slug: "reference/evaluation" }],
        },
        {
          label: "Integrations",
          items: [{ slug: "integrations/hermes-install" }, { slug: "integrations/context7-mcp" }],
        },
        {
          label: "Roadmap",
          items: [{ slug: "roadmap/v1-v2-roadmap" }],
        },
        {
          label: "Research",
          items: [
            { slug: "research/meta-memory-os-brief" },
            { slug: "research/provider-comparison" },
          ],
        },
      ],
    }),
  ],
});
