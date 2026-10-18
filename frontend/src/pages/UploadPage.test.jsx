import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UploadPage } from './UploadPage';
vi.mock('../api/datasets', () => ({ uploadDataset: vi.fn() }));
describe('UploadPage', () => {
    it('shows the guided upload experience', () => {
        render(<MemoryRouter><UploadPage /></MemoryRouter>);
        expect(screen.getByRole('heading', { name: /analyze your spreadsheet/i })).toBeInTheDocument();
        expect(screen.getByText(/drop your spreadsheet here/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /try a sample dataset/i })).toBeInTheDocument();
    });
});
