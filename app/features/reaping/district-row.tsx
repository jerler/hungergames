import type { ReapingValidationResult } from "~/features/reaping/reaping-validation";
import type { TributeDraft } from "~/game/types/tribute";

import { TributeCardEditor } from "./tribute-card-editor";

interface DistrictRowProps {
  district: number;
  tributes: readonly TributeDraft[];
  tributeErrors: ReapingValidationResult["tributeErrors"];
  onTributeChange: (tribute: TributeDraft) => void;
  onTributeRandomize: (tributeId: string) => void;
}

export function DistrictRow({
  district,
  tributes,
  tributeErrors,
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
            validationErrors={tributeErrors[tribute.id]}
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
