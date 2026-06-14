import FretDeck from "@/app/fretdeck-app";
export default async function Page({ params }) {
  const { token } = await params;
  return <FretDeck token={token} />;
}
