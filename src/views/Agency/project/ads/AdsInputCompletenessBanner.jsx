import React from "react";

// Banner in cima alla pagina Ads: dice in una riga se gli input bastano per
// impostare le campagne, e cosa manca. Il tono lo decide chi calcola la
// completezza, non questo componente.
const AdsInputCompletenessBanner = ({ tone, label, missing }) => {
  const mancanti = missing || [];

  return (
    <div className={`alert alert-${tone} py-2 mb-3`}>
      <strong>Qualita input Ads:</strong> {label}
      {mancanti.length > 0 && (
        <span> | Mancano o sono deboli: {mancanti.join(", ")}</span>
      )}
    </div>
  );
};

export default AdsInputCompletenessBanner;
