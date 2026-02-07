-- Delete the 10 empty EMT assemblies
DELETE FROM assemblies 
WHERE id IN (
  'd048ce2f-3c51-4640-82c5-b0fa2c332d72',
  '74d0b081-e89f-4ff2-a2f5-b6a46eda2ba3',
  '709b2f76-8edf-45c8-9dab-615008c8ea23',
  '99f52868-0af0-4339-91f2-83b9a94178a3',
  'f13e027e-c970-4419-8e63-4fbb0eb7bcaf',
  '7be5a399-f5c9-423d-b19c-2e06d96d2c8c',
  '321fdcd2-f6c0-4118-83cd-ee3e9c07a6a9',
  'beaef3a1-e987-49a5-9caf-3a152d2f3789',
  '4c690549-1e3e-40ae-ad0c-4148ff227076',
  '296776db-7d61-434b-855c-36a4d2189da6'
);
