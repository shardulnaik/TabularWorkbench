import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PredictPage } from './PredictPage';

vi.mock('../api/datasets', () => ({ getProfile: vi.fn() }));
vi.mock('../api/ml', () => ({ getModelRun: vi.fn(), predictRecord: vi.fn(), trainModel: vi.fn() }));
vi.mock('../api/charts', () => ({ createChart: vi.fn() }));
import { getProfile } from '../api/datasets';
import { getModelRun, predictRecord, trainModel } from '../api/ml';

const trainedRun = { model_run_id: 'run-1', target_column: 'Department', task_type: 'classification', model_label: 'Random Forest Classifier', metrics: { accuracy: 0.9 }, train_rows: 80, test_rows: 20, warnings: [], feature_schema: [
  { name: 'Age', kind: 'numeric' }, { name: 'Region', kind: 'categorical', categories: ['North', 'South'] },
] };

describe('PredictPage', () => {
  it('trains from the selected target then predicts one record from the generated feature form', async () => {
    vi.mocked(getProfile).mockResolvedValue({ profile: { columns: [
      { name: 'EmployeeID', kind: 'categorical', is_constant: false, target_eligibility: {} },
      { name: 'Age', kind: 'numeric', is_constant: false, target_eligibility: {} },
      { name: 'Department', kind: 'categorical', is_constant: false, target_eligibility: { classification: { applicable: true } } },
    ] } });
    vi.mocked(trainModel).mockResolvedValue(trainedRun);
    vi.mocked(getModelRun).mockResolvedValue(trainedRun);
    vi.mocked(predictRecord).mockResolvedValue({ predicted_value: 'IT', probabilities: { IT: 0.8, HR: 0.2 }, warnings: [] });
    render(<MemoryRouter initialEntries={['/datasets/dataset-1/predict']}><Routes><Route path="/datasets/:datasetId/predict" element={<PredictPage/>}/></Routes></MemoryRouter>);

    await screen.findByRole('combobox', { name: /target column/i });
    fireEvent.change(screen.getByRole('combobox', { name: /target column/i }), { target: { value: 'Department' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByRole('heading', { name: /enter one new record/i });
    expect(trainModel).toHaveBeenCalledWith('dataset-1', 'Department');
    expect(screen.queryByLabelText('EmployeeID')).not.toBeInTheDocument();

    await screen.findByLabelText('Age');
    await screen.findByLabelText('Age');
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '23' } });
    fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'North' } });
    fireEvent.click(screen.getByRole('button', { name: /generate prediction/i }));
    await waitFor(() => expect(predictRecord).toHaveBeenCalledWith('dataset-1', 'run-1', { Age: '23', Region: 'North' }));
    expect(await screen.findByText('IT')).toBeInTheDocument();
    expect(screen.getByText(/estimated probability: 80.0%/i)).toBeInTheDocument();
    expect(screen.getAllByText('Generate chart')[0]).toBeInTheDocument();
  });
});



