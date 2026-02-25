import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import QuotesModuleGate from '../../modules/quotes/ui/QuotesModuleGate';
import { QUOTES_PERMISSIONS } from '../../modules/quotes/ui/constants';
import QuoteWizardForm from '../../modules/quotes/ui/QuoteWizardForm';
import '../../modules/quotes/ui/quotes-ui.css';

const QuoteFormPage = ({ mode = 'create' }) => {
  const { id } = useParams();
  const location = useLocation();
  const isEditMode = mode === 'edit' || location.pathname.endsWith('/edit');
  const requiredPermission = isEditMode ? QUOTES_PERMISSIONS.edit : QUOTES_PERMISSIONS.create;

  return (
    <QuotesModuleGate requiredPermission={requiredPermission}>
      <div className="container-fluid quotes-page-container">
        <QuoteWizardForm mode={isEditMode ? 'edit' : 'create'} quoteId={isEditMode ? id : undefined} />
      </div>
    </QuotesModuleGate>
  );
};

export default QuoteFormPage;
