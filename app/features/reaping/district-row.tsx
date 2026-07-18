import type { TributeDraft } from "~/game/types/tribute";

import { TributeCardEditor } from "./tribute-card-editor";

interface DistrictRowProps {
  district: number;
  tributes: readonly TributeDraft[];
  onTributeChange: (tribute: TributeDraft) => void;
  onTributeRandomize: (tributeId: string) => void;
}

export function DistrictRow({
  district,
  tributes,
  onTributeChange,
  onTributeRandomize,
}: DistrictRowProps) {
  return (
    <section className="district-row" aria-labelledby={`district-${district}-title`}>
      <header className="district-row__header">
        <span>District</span>

        <h2 id={`district-${district}-title`}>{district}</h2>
      </header>

      <div className="district-row__tributes">
        {tributes.map((tribute) => (
          <TributeCardEditor
            key={tribute.id}
            tribute={tribute}
            onChange={onTributeChange}
            onRandomize={() => {
              onTributeRandomize(tribute.id);
            }}
          />
        ))}
      </div>
    </section>
  );
}
