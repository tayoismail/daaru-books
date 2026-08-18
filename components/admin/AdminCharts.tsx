import { Bar, Doughnut } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";

// This module touches the DOM (canvas) and must only be loaded on the client —
// import it with `next/dynamic(..., { ssr: false })`.
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

// Pin the currency format to Latin digits so chart ticks/tooltips always match
// the server-rendered stat cards, even in an Arabic (Arabic-Indic) locale.
const formatNaira = (value: number) => `₦${value.toLocaleString("en-US")}`;

export interface MonthlyBarChartProps {
  labels: string[];
  sales: number[];
  expenses: number[];
  refunds: number[];
  salesLabel: string;
  expensesLabel: string;
  refundsLabel: string;
}

export function MonthlyBarChart({
  labels,
  sales,
  expenses,
  refunds,
  salesLabel,
  expensesLabel,
  refundsLabel,
}: MonthlyBarChartProps) {
  return (
    <div className="h-72">
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: salesLabel,
              data: sales,
              backgroundColor: "#1a5c3a",
              borderRadius: 6,
              maxBarThickness: 36,
            },
            {
              label: expensesLabel,
              data: expenses,
              backgroundColor: "#f43f5e",
              borderRadius: 6,
              maxBarThickness: 36,
            },
            {
              label: refundsLabel,
              data: refunds,
              backgroundColor: "#c9a84c",
              borderRadius: 6,
              maxBarThickness: 36,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { usePointStyle: true, boxWidth: 8 },
            },
            tooltip: {
              callbacks: {
                label: (context) =>
                  ` ${context.dataset.label}: ${formatNaira(
                    Number(context.parsed.y)
                  )}`,
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              ticks: { callback: (value) => formatNaira(Number(value)) },
            },
          },
        }}
      />
    </div>
  );
}

export interface CashFlowBarChartProps {
  labels: string[];
  received: number[];
  paidOut: number[];
  receivedLabel: string;
  paidOutLabel: string;
}

/** Cash in (payments received) vs cash out (expenses + refunds) per bucket. */
export function CashFlowBarChart({
  labels,
  received,
  paidOut,
  receivedLabel,
  paidOutLabel,
}: CashFlowBarChartProps) {
  return (
    <div className="h-72">
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: receivedLabel,
              data: received,
              backgroundColor: "#16a34a",
              borderRadius: 6,
              maxBarThickness: 36,
            },
            {
              label: paidOutLabel,
              data: paidOut,
              backgroundColor: "#f43f5e",
              borderRadius: 6,
              maxBarThickness: 36,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { usePointStyle: true, boxWidth: 8 },
            },
            tooltip: {
              callbacks: {
                label: (context) =>
                  ` ${context.dataset.label}: ${formatNaira(
                    Number(context.parsed.y)
                  )}`,
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              ticks: { callback: (value) => formatNaira(Number(value)) },
            },
          },
        }}
      />
    </div>
  );
}

export interface ExpenseDoughnutChartProps {
  labels: string[];
  values: number[];
}

const PALETTE = ["#1a5c3a", "#c9a84c", "#f43f5e", "#3b82f6", "#8b5cf6"];

export function ExpenseDoughnutChart({ labels, values }: ExpenseDoughnutChartProps) {
  return (
    <div className="h-72">
      <Doughnut
        data={{
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
              borderColor: "#ffffff",
              borderWidth: 2,
              hoverOffset: 6,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: {
            legend: {
              position: "bottom",
              labels: { usePointStyle: true, boxWidth: 8 },
            },
            tooltip: {
              callbacks: {
                label: (context) =>
                  ` ${context.label}: ${formatNaira(Number(context.parsed))}`,
              },
            },
          },
        }}
      />
    </div>
  );
}
