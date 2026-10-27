import { FormLayout } from "@/ui/components/FormLayout";
import { LinkButton } from "@/ui/components/LinkButton";

export default function NotFound() {
  return (
    <FormLayout title="Page not found">
      <div className="flex flex-col gap-4">
        <span className="text-zinc-600">The page you&apos;re looking for doesn&apos;t exist or has moved.</span>
        <LinkButton href="/">Back to home</LinkButton>
      </div>
    </FormLayout>
  );
}
