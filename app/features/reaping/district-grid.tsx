import type { DistrictCount } from "~/game/types/game-config";
import type { TributeDraft } from "~/game/types/tribute";

import { DistrictRow } from "./district-row";

interface DistrictGridProps {
  districtCount: DistrictCount;
  tributes: readonly TributeDraft[];
  onTributeChange: (tribute: TributeDraft) => void;
  onTributeRandomize: (tributeId: string) => void;
}

export function DistrictGrid({
  districtCount,
  tributes,
  onTributeChange,
  onTributeRandomize,
}: DistrictGridProps) {
  const districts = Array.from(
    {
      length: districtCount,
    },
    (_, index) => index + 1,
  );

  return (
    <div className="district-grid">
      {districts.map((district) => {
        const districtTributes = tributes
          .filter((tribute) => tribute.district === district)
          .sort(
            (firstTribute, secondTribute) =>
              firstTribute.districtPosition - secondTribute.districtPosition,
          );

        return (
          <DistrictRow
            key={district}
            district={district}
            tributes={districtTributes}
            onTributeChange={onTributeChange}
            onTributeRandomize={onTributeRandomize}
          />
        );
      })}
    </div>
  );
}
