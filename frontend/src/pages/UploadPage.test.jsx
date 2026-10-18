import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { UploadPage } from './UploadPage';
vi.mock('../api/datasets', () => ({ uploadDataset: vi.fn() }));
vi.mock('../api/cleaning', () => ({
    getCleaningPlan: vi.fn(),
    applyCleaning: vi.fn(),
}));
import { uploadDataset } from '../api/datasets';
import { applyCleaning, getCleaningPlan } from '../api/cleaning';
describe('UploadPage', () => {
    it('keeps the starting screen focused on the centered upload entry point', () => {
        render(<MemoryRouter><UploadPage /></MemoryRouter>);
        expect(screen.getByRole('heading', { name: /upload a file/i })).toBeInTheDocument();
        expect(screen.getByText(/drop your spreadsheet here/i)).toBeInTheDocument();
        expect(screen.queryByText(/made clear/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /try a sample dataset/i })).not.toBeInTheDocument();
    });

    it('applies recommended safe cleaning before opening the dataset', async () => {
        vi.mocked(uploadDataset).mockResolvedValue({ session_id: 'dataset-1' });
        vi.mocked(getCleaningPlan).mockResolvedValue({ recommended_action_ids: ['trim_whitespace'] });
        vi.mocked(applyCleaning).mockResolvedValue({ actions_applied: ['trim_whitespace'] });
        const { container } = render(<MemoryRouter initialEntries={['/']}><Routes>
          <Route path="/" element={<UploadPage/>}/>
          <Route path="/datasets/:datasetId" element={<p>dataset-ready</p>}/>
        </Routes></MemoryRouter>);

        fireEvent.change(container.querySelector('input[type="file"]'), {
            target: { files: [new File(['name\nvalue'], 'data.csv', { type: 'text/csv' })] },
        });

        await waitFor(() => expect(screen.getByText('dataset-ready')).toBeInTheDocument());
        expect(getCleaningPlan).toHaveBeenCalledWith('dataset-1');
        expect(applyCleaning).toHaveBeenCalledWith('dataset-1', ['trim_whitespace']);
    });
});
