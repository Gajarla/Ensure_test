pipeline {
    agent any

    environment {
        BACKEND_DIR = "/home/t_admin/Backend"
        FRONTEND_DIR = "/var/www/html"
        REPO_URL = "https://github.com/Gajarla/Ensure_test.git"
    }

    triggers {
        githubPush()   // 🔥 Auto trigger on GitHub push
    }

    stages {

        stage('Checkout Code') {
            steps {
                script {
                    // Pull everything
                    checkout([
                        $class: 'GitSCM',
                        branches: [[name: '**']],
                        userRemoteConfigs: [[url: REPO_URL]]
                    ])

                    CURRENT_BRANCH = sh(returnStdout: true, script: "git rev-parse --abbrev-ref HEAD").trim()
                    echo "Triggered by branch: ${CURRENT_BRANCH}"
                }
            }
        }

        stage('Deploy Backend') {
            when { expression { CURRENT_BRANCH == "backend" || CURRENT_BRANCH == "main" } }
            steps {
                script {
                    echo "Deploying Backend..."

                    sh """
                    sudo rm -rf ${BACKEND_DIR}
                    sudo mkdir -p ${BACKEND_DIR}
                    sudo cp -r backend/* ${BACKEND_DIR}/

                    cd ${BACKEND_DIR}
                    sudo npm install

cat <<EOF | sudo tee ${BACKEND_DIR}/.env
APP_ENV=demo
MONGOURI=mongodb://teadmin:sailoteadm1n@16.112.109.41:27017/tedb
APP_URL=http://app.testensure.com
JENKINS_HOST=http://16.112.109.41:8080
JENKINS_AUTH=Sunil kumar:1159b1a251795c8bd45df729f363fd08a4
NODE_TLS_REJECT_UNAUTHORIZED="0"
EOF

                    sudo forever stopall || true
                    sudo forever start server.js
                    """
                }
            }
        }

        stage('Deploy Frontend') {
            when { expression { CURRENT_BRANCH == "Frontend" || CURRENT_BRANCH == "main" } }
            steps {
                script {
                    echo "Deploying Frontend..."

                    sh """
                    cd frontend
                    npm install
                    npm run build

                    sudo rm -rf ${FRONTEND_DIR}/*
                    sudo cp -r build/* ${FRONTEND_DIR}/

                    sudo systemctl restart apache2 || sudo systemctl restart httpd
                    """
                }
            }
        }
    }

    post {
        success {
            echo "CI/CD Successfully Completed!"
        }
        failure {
            echo "CI/CD Failed!"
        }
    }
}
