// Initialisation du graphique
document.addEventListener('DOMContentLoaded', function() {
    const ctx = document.getElementById('networkStats');
    if (ctx) {
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({length: 10}, (_, i) => i + 1),
                datasets: [{
                    label: 'Connexions actives',
                    data: generateRandomData(10),
                    borderColor: '#3498db',
                    tension: 0.4,
                    fill: false
                }, {
                    label: 'Transferts de données (MB)',
                    data: generateRandomData(10, 100),
                    borderColor: '#2ecc71',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Statistiques du réseau P2P'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Mise à jour des données toutes les 3 secondes
        setInterval(() => {
            chart.data.datasets.forEach(dataset => {
                dataset.data.shift();
                dataset.data.push(generateRandomValue(dataset.label.includes('MB') ? 100 : 10));
            });
            chart.update();
        }, 3000);
    }

    // Gestion du formulaire de contact
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Merci pour votre message ! Nous vous répondrons dans les plus brefs délais.');
            this.reset();
        });
    }
});

// Fonctions utilitaires
function generateRandomData(length, max = 10) {
    return Array.from({length}, () => generateRandomValue(max));
}

function generateRandomValue(max) {
    return Math.floor(Math.random() * max);
} 