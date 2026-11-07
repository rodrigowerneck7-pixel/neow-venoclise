import { Card } from "./campos";

export function ComoInstalar() {
  return (
    <Card titulo="Como instalar no iPhone">
      <ol className="list-decimal pl-5 space-y-1 text-body-sm">
        <li>Abra o endereço do app no <strong>Safari</strong> (não em outro navegador).</li>
        <li>Toque em <strong>Compartilhar</strong> (quadrado com seta) e depois em <strong>Adicionar à Tela de Início</strong>.</li>
        <li>Abra sempre pelo <strong>ícone</strong> da Tela de Início. Depois da primeira abertura com internet, o app funciona offline.</li>
      </ol>
      <p className="text-body-sm text-danger">
        Atenção: o app da Tela de Início guarda os dados <strong>separados do Safari</strong>. Pacientes salvos em um não aparecem no outro. Se mudar de um para o outro, use Exportar/Importar backup.
      </p>
      <p className="text-caption text-subtle">Sites não instalados podem ter os dados apagados pelo iOS após cerca de 7 dias sem uso. Instalar e fazer backups reduz esse risco.</p>
    </Card>
  );
}
