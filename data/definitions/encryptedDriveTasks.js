// encryptedDriveTasks.js - Task definitions for Encrypted Drive section

export function getInitialDriveTasks() {
    return [
        {
            id: 'extract_key_material',
            name: 'Extract Key Material',
            description: 'Isolate cryptographic key fragments from damaged sectors. High complexity — resource-intensive and time-consuming.',
            duration: 20,
            cost: [
                { resource: 'Scrap Metal', amount: 20 },
                { resource: 'Wire', amount: 15 }
            ],
            xp: 50,
            running: false,
            progress: 0,
            completed: false,
            _timer: null,
            _startAt: 0
        },
        {
            id: 'build_cipher_dictionary',
            name: 'Build Cipher Dictionary',
            description: 'Assemble a lookup map of recurring tokens and seeds. Moderately expensive step with noticeable runtime.',
            duration: 25,
            cost: [
                { resource: 'Fabric', amount: 5 },
                { resource: 'Chemicals', amount: 5 },
                { resource: 'Wire', amount: 10 }
            ],
            xp: 70,
            running: false,
            progress: 0,
            completed: false,
            _timer: null,
            _startAt: 0
        },
        {
            id: 'pattern_analysis',
            name: 'Pattern Analysis',
            description: 'Scan blocks for repeating structures and probable key schedules. High cost and longer analysis time.',
            duration: 30,
            cost: [
                { resource: 'Scrap Metal', amount: 15 },
                { resource: 'Chemicals', amount: 8 }
            ],
            xp: 80,
            running: false,
            progress: 0,
            completed: false,
            _timer: null,
            _startAt: 0
        },
        {
            id: 'signal_reconstruction',
            name: 'Signal Reconstruction',
            description: 'Rebuild and align encoded bursts into a coherent signal. Very high computational cost and long runtime.',
            duration: 40,
            cost: [
                { resource: 'Wire', amount: 25 },
                { resource: 'Scrap Metal', amount: 30 }
            ],
            xp: 100,
            running: false,
            progress: 0,
            completed: false,
            _timer: null,
            _startAt: 0
        },
        {
            id: 'final_decryption_attempt',
            name: 'Final Decryption Attempt',
            description: 'Full-spectrum brute-force with heuristic seed search. Extremely expensive and lengthy operation.',
            duration: 60,
            cost: [
                { resource: 'Power Cells', amount: 1 },
                { resource: 'Wire', amount: 50 }
            ],
            xp: 150,
            running: false,
            progress: 0,
            completed: false,
            _timer: null,
            _startAt: 0
        },
        {
            id: 'integrity_verification',
            name: 'Integrity Verification',
            description: 'Validate decrypted blocks against checksums and redundancy codes. Ensure no corruption occurred during unlock.',
            duration: 35,
            cost: [
                { resource: 'Scrap Metal', amount: 40 },
                { resource: 'Chemicals', amount: 10 }
            ],
            xp: 120,
            running: false,
            progress: 0,
            completed: false,
            _timer: null,
            _startAt: 0
        },
        {
            id: 'data_stream_parsing',
            name: 'Data Stream Parsing',
            description: 'Parse raw bitstreams into structured records and metadata. Extract human-readable logs and manifests.',
            duration: 45,
            cost: [
                { resource: 'Wire', amount: 60 },
                { resource: 'Power Cells', amount: 2 }
            ],
            xp: 180,
            running: false,
            progress: 0,
            completed: false,
            _timer: null,
            _startAt: 0
        },
        {
            id: 'archive_complete_access',
            name: 'Archive Complete Access',
            description: 'Full archive unlock complete. All encrypted logs, schematics, and mission data are now accessible.',
            duration: 50,
            cost: [
                { resource: 'Power Cells', amount: 3 },
                { resource: 'Chemicals', amount: 15 },
                { resource: 'Wire', amount: 80 }
            ],
            xp: 250,
            running: false,
            progress: 0,
            completed: false,
            _timer: null,
            _startAt: 0
        }
    ];
}

// Mutable array holding runtime task state
export let driveTasks = getInitialDriveTasks();

export function resetDriveTasks() {
    driveTasks.length = 0;
    driveTasks.push(...getInitialDriveTasks());
}
