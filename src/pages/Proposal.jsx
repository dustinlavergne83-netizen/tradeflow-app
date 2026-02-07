import { useSearchParams } from "react-router-dom";
import ProposalCommercialPublic from "./ProposalCommercialPublic";
import ProposalResidentialContractor from "./ProposalResidentialContractor";

// This component routes to the correct proposal template based on type
export default function Proposal() {
  const [searchParams] = useSearchParams();
  const proposalType = searchParams.get('type') || 'commercial-public';

  // Route to the correct template based on proposal type
  switch (proposalType) {
    case 'commercial-public':
      return <ProposalCommercialPublic />;
    
    case 'commercial-private':
      // For now, use the same template - can be customized later
      return <ProposalCommercialPublic />;
    
    case 'residential-contractor':
      return <ProposalResidentialContractor />;
    
    case 'residential-owner':
      // For now, use the same template - can be customized later
      return <ProposalCommercialPublic />;
    
    default:
      return <ProposalCommercialPublic />;
  }
}
