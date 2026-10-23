// Logos oficiais da Proativa Jr. (arquivos do kit de marca, nunca reconstruídos com texto).
export function Assinatura({ class: cls = 'logo' }: { class?: string }) {
  return (
    <picture>
      <source srcSet="./marca/assinatura-horizontal-negativa.png" media="(prefers-color-scheme: dark)" />
      <img class={cls} src="./marca/assinatura-horizontal-positiva.png" alt="Proativa Jr." width={146} height={32} />
    </picture>
  );
}
export function Simbolo({ class: cls = 'av-logo' }: { class?: string }) {
  return <img class={cls} src="./marca/simbolo-96.png" alt="Proativa Jr." width={32} height={32} />;
}
