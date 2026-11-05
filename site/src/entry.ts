import './styles.css';
import { Runtime } from 'foldkit';
import { program } from './program.ts';

const application = Runtime.makeApplication({
  ...program,
  container: document.getElementById('root'),
});

Runtime.hydrate(application);
