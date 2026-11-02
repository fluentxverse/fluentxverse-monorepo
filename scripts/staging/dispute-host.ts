import { resolve, sep } from "node:path";
const component = process.env.STAGE_COMPONENT,
	root = resolve(process.env.STAGE_ROOT || "/assets");
Bun.serve({
	hostname: "0.0.0.0",
	port: component === "filer" ? 8888 : 8080,
	maxRequestBodySize: 16 * 1024 * 1024,
	async fetch(request) {
		const url = new URL(request.url),
			path = decodeURIComponent(url.pathname);
		if (component === "filer") {
			if (!/^\/private-lesson-issues\/[a-f0-9-]{36}\.bin$/.test(path))
				return new Response("Not found", { status: 404 });
			const file = resolve(root, path.split("/").at(-1)!);
			if (request.method === "PUT") {
				await Bun.write(file, await request.arrayBuffer());
				return Response.json({ name: "stored" });
			}
			if (request.method === "DELETE") {
				await Bun.file(file)
					.delete()
					.catch(() => {});
				return new Response(null, { status: 204 });
			}
			if (request.method === "GET" && (await Bun.file(file).exists()))
				return new Response(Bun.file(file));
			return new Response("Not found", { status: 404 });
		}
		if (request.method !== "GET" && request.method !== "HEAD")
			return new Response("Method not allowed", { status: 405 });
		const file = resolve(root, "." + path);
		if (
			(file !== root && !file.startsWith(root + sep)) ||
			path.split("/").some((p) => p.startsWith("."))
		)
			return new Response("Not found", { status: 404 });
		const asset = Bun.file(file);
		return new Response(
			file !== root && (await asset.exists())
				? asset
				: Bun.file(resolve(root, "index.html")),
			{
				headers: {
					"Cache-Control": "no-store",
					"X-Robots-Tag": "noindex, nofollow",
				},
			},
		);
	},
});
