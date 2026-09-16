import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "../../../lib/sdk";
import { Tier } from "../page";
import { TierDetailsSection, TierRulesTable, TierCustomersTable } from "../../../components";

type TierResponse = {
    tier: Tier;
};

const TierDetailsPage = () => {
    const { id } = useParams();

    const { data: tierData } = useQuery({
        queryFn: () =>
            sdk.client.fetch<TierResponse>(`/admin/tiers/${id}`, {
                method: "GET",
            }),
        queryKey: ["tier", id],
        enabled: !!id,
    });

    const tier = tierData?.tier;

    return (
        <>
            <TierDetailsSection tier={tier} />
            <TierRulesTable tierRules={tier?.tier_rules} />
            {tier?.id && <TierCustomersTable tierId={tier.id} />}
        </>
    );
};

export default TierDetailsPage;
