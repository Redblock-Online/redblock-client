import dynamic from "next/dynamic";

const EditorClient = dynamic(() => import("@/next/EditorClient"), { ssr: false });

export default function EditorPage() {
  return (
    <main className="relative h-full w-full">
      <EditorClient />
    </main>
  );
}
