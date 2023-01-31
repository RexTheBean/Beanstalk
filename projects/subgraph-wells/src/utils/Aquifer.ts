import { Address } from "@graphprotocol/graph-ts";
import { Aquifer } from "../../generated/schema";

export function loadOrCreateAquifer(aquiferAddress: Address, auger: Address): Aquifer {
    let aquifer = Aquifer.load(aquiferAddress)
    if (aquifer == null) {
        aquifer = new Aquifer(aquiferAddress)
        aquifer.auguer = auger
        aquifer.save()
    }
    return aquifer as Aquifer
}
